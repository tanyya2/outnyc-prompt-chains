import type { createClient } from "@/utils/supabase/server";
import { fetchCategory, fetchMix, type Place } from "./google";
import { GeminiBusyError, askGemini, parsePlan, type GeminiAttempt, type GeminiPlan, type Model } from "./gemini";
import { CATEGORIES, STOPS, type Category } from "./nyc";

// Runs a chain's steps in order to make one plan, the way OutNYC does
// (web/app/explore/plan.ts), then logs the request like OutNYC for the admin.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RunInput = {
  neighborhood: string;
  lat: number;
  lon: number;
  radiusMiles: number;
  budget: string;
  purpose: string;
  // Empty = any kind of place
  categories: Category[];
  openNow: boolean;
};

// What each step did, shown under the plan
export type StepResult = { name: string; kind: string; ok: boolean; ms: number; output: string };

export type RunPlan = {
  title: string;
  tip: string;
  stops: { name: string; category: string; minutes: number; note: string; mapsUrl: string | null }[];
};

export type RunResult = { steps: StepResult[]; plan: RunPlan | null; planId: number | null; error: string | null };

type Step = {
  name: string;
  kind: string;
  prompt_text: string | null;
  temperature: number | string | null;
  llm_models: { name: string; thinking_off: boolean } | null;
};

// What the steps hand to each other
type Run = {
  input: RunInput;
  found: Place[];
  places: Place[] | null;
  picked: Category[];
  prompt: string | null;
  plan: GeminiPlan | null;
  lastAsk: { text: string; models: Model[]; temperature: number | null } | null;
  model: string | null;
  attempts: GeminiAttempt[];
  planId: number | null;
};

// A step can't go on; the message says why
class StepError extends Error {}

const GOOGLE_LIMIT_ERROR = "Today's Google searches are used up (30 a day, shared with OutNYC). Try again tomorrow.";

export async function runChain(supabase: Supabase, chainId: number, input: RunInput): Promise<RunResult> {
  const started = Date.now();
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .select("name, kind, prompt_text, temperature, llm_models(name, thinking_off)")
    .eq("chain_id", chainId)
    .order("step_order");
  if (error) return { steps: [], plan: null, planId: null, error: `Couldn't read the steps: ${error.message}` };
  const steps = (data ?? []) as unknown as Step[];
  if (steps.length === 0) return { steps: [], plan: null, planId: null, error: "This chain has no steps." };

  const run: Run = {
    input,
    found: [],
    places: null,
    picked: [],
    prompt: null,
    plan: null,
    lastAsk: null,
    model: null,
    attempts: [],
    planId: null,
  };
  const results: StepResult[] = [];
  let failure: string | null = null;

  for (const [i, step] of steps.entries()) {
    const stepStarted = Date.now();
    try {
      const output = await runStep(supabase, step, run);
      results.push({ name: step.name, kind: step.kind, ok: true, ms: Date.now() - stepStarted, output });
    } catch (err) {
      const known = err instanceof StepError || err instanceof GeminiBusyError;
      const message = known ? err.message : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
      if (!known) console.error("runChain:", err);
      results.push({ name: step.name, kind: step.kind, ok: false, ms: Date.now() - stepStarted, output: message });
      failure = `Step ${i + 1} (${step.name}) failed: ${message}`;
      break;
    }
  }
  if (!failure && !run.plan) failure = "The chain finished without a plan: it needs an Ask AI step.";

  const plan = run.plan && run.places ? toRunPlan(run.plan, run.places) : null;
  await logRequest(supabase, chainId, run, failure, Date.now() - started);
  return { steps: results, plan, planId: run.planId, error: failure };
}

async function runStep(supabase: Supabase, step: Step, run: Run): Promise<string> {
  const { input } = run;
  const chosen = input.categories;
  // More than 4 picked: only 4 can be used anyway, so no category is required
  const allNeeded = chosen.length <= STOPS.max;
  const openOnly = (list: Place[]) => (input.openNow ? list.filter((place) => place.openNow !== false) : list);
  const missingFrom = (list: Place[]) =>
    allNeeded ? chosen.filter((category) => !list.some((place) => place.category === category)) : [];

  switch (step.kind) {
    case "google_places": {
      // One Google request: the 20 most popular places nearby across the categories
      const categories = chosen.length > 0 ? chosen : (Object.keys(CATEGORIES) as Category[]);
      if (!(await reserveGoogle(supabase, 1))) throw new StepError(GOOGLE_LIMIT_ERROR);
      run.found = await fetchMix(categories, input.lat, input.lon, input.radiusMiles);
      run.places = [...run.found];
      return `Google found ${run.found.length} places: ${countByCategory(run.found)}.`;
    }

    case "filter": {
      if (!run.places) throw new StepError("No places yet: put a Google search step before this one.");
      // Drop closed places; a place that fits an empty picked category too can fill it;
      // otherwise one extra search for each picked category still missing
      const places = openOnly(run.places);
      fillMissing(places, missingFrom(places));
      const missing = missingFrom(places);
      if (missing.length > 0) {
        if (!(await reserveGoogle(supabase, missing.length))) throw new StepError(GOOGLE_LIMIT_ERROR);
        const extra = (
          await Promise.all(missing.map((category) => fetchCategory(category, input.lat, input.lon, input.radiusMiles)))
        ).flat();
        const seen = new Set(run.found.map((place) => place.id));
        const fresh = extra.filter((place) => !seen.has(place.id));
        run.found = [...run.found, ...fresh];
        places.push(...openOnly(fresh));
      }
      run.places = places;
      const extraNote = missing.length ? ` Extra search for ${labels(missing)}.` : "";
      const open = input.openNow ? "open " : "";
      if (places.length === 0) throw new StepError(`Nothing ${open}nearby. Try a bigger distance or other categories.${extraNote}`);
      const empty = missingFrom(places);
      if (empty.length > 0) {
        throw new StepError(`No ${open}${labels(empty, " or ")} places nearby (${countByCategory(places)}).${extraNote}`);
      }
      return `${places.length} ${open}places left: ${countByCategory(places)}.${extraNote}`;
    }

    case "prompt": {
      if (!run.places?.length) throw new StepError("No places yet: put a Google search step before this one.");
      if (!step.prompt_text) throw new StepError("This step has no prompt text.");
      run.picked = pickedOf(run);
      run.prompt = fillMarkers(step.prompt_text, run);
      return run.prompt;
    }

    case "llm_call": {
      if (!run.places?.length) throw new StepError("No places yet: put a Google search step before this one.");
      // Its own text (with {plan} = the plan so far), or the prompt built before it
      const text = step.prompt_text ? fillMarkers(step.prompt_text, run) : run.prompt;
      if (!text) {
        throw new StepError("Nothing to send: put a Build the prompt step before this one, or give this step prompt text.");
      }
      const models = step.llm_models
        ? [{ name: step.llm_models.name, thinkingOff: step.llm_models.thinking_off }]
        : await activeModels(supabase);
      const temperature = step.temperature === null ? null : Number(step.temperature);
      run.lastAsk = { text, models, temperature };
      const reply = await askGemini(text, models, temperature, run.attempts);
      run.model = reply.model;
      const plan = parsePlan(reply.text, run.places.length);
      if (!plan) throw new StepError(`${reply.model}'s reply wasn't a usable plan:\n\n${reply.text.slice(0, 2000)}`);
      run.plan = plan;
      return `Sent to ${reply.model}${temperature === null ? "" : ` (temperature ${temperature})`}:\n\n${text}\n\nReply:\n\n${reply.text}`;
    }

    case "check": {
      if (!run.plan || !run.places) throw new StepError("No plan to check yet: put an Ask AI step before this one.");
      if (run.picked.length === 0) run.picked = pickedOf(run);
      let checked = checkStops(run.plan, run.places, run.picked);
      if (checked) {
        run.plan = checked;
        return `OK: ${checked.stops.length} stops follow the rules.`;
      }
      // Broke the rules (too few places, a missing category) → ask once more
      if (!run.lastAsk) throw new StepError("The plan breaks the rules, and there's no Ask AI step to ask again.");
      const { text, models, temperature } = run.lastAsk;
      const reply = await askGemini(text, models, temperature, run.attempts);
      run.model = reply.model;
      checked = checkStops(parsePlan(reply.text, run.places.length), run.places, run.picked);
      if (!checked) {
        throw new StepError("The plan broke the rules (number of stops or picked categories) twice. Both replies are in the admin's LLM responses.");
      }
      run.plan = checked;
      return `The first plan broke the rules, so ${reply.model} was asked once more. Now OK: ${checked.stops.length} stops.\n\nReply:\n\n${reply.text}`;
    }

    case "save": {
      if (!run.plan || !run.places) throw new StepError("No plan to save yet: put an Ask AI step before this one.");
      const places = run.places;
      // What we store: Google place id and name, plus the AI's text (Google's terms)
      const content = {
        title: run.plan.title,
        stops: run.plan.stops.map((stop) => {
          const place = places[stop.place - 1];
          return { placeId: place.id, name: place.name, category: place.category, minutes: stop.minutes, note: stop.note };
        }),
        tip: run.plan.tip,
      };
      const { data, error } = await supabase
        .from("plans")
        .insert({
          neighborhood: input.neighborhood,
          inputs: { radiusMiles: input.radiusMiles, categories: chosen, purpose: input.purpose, budget: input.budget, openNow: input.openNow },
          places: places.map((place) => ({ id: place.id, category: place.category })),
          prompt: run.prompt ?? run.lastAsk?.text ?? "",
          model: run.model,
          content: JSON.stringify(content),
        })
        .select("id")
        .single();
      if (error) throw new StepError(`Saving failed: ${error.message}`);
      run.planId = data.id;
      return `Saved as plan #${data.id}.`;
    }

    default:
      throw new StepError(`Unknown kind of step: ${step.kind}`);
  }
}

// ─── Same rules as OutNYC ────────────────────────────────────────────────────

// Our own cap on Google requests (30 a day for OutNYC and this tool together)
async function reserveGoogle(supabase: Supabase, count: number) {
  const { data, error } = await supabase.rpc("use_google_requests", { n: count });
  if (error) console.error("reserveGoogle:", error);
  return data === true;
}

// The Gemini models the admin turned on, in its order
async function activeModels(supabase: Supabase): Promise<Model[]> {
  const { data, error } = await supabase
    .from("llm_models")
    .select("name, thinking_off, llm_providers!inner(name)")
    .eq("is_active", true)
    .eq("llm_providers.name", "Google Gemini")
    .order("sort_order");
  if (error) throw new StepError(`Couldn't read the models: ${error.message}`);
  if (!data?.length) throw new StepError("No active Gemini models: turn one on in the admin's LLM models page.");
  return data.map((model) => ({ name: model.name, thinkingOff: model.thinking_off }));
}

// Picked categories that have places to choose from
const pickedOf = (run: Run) =>
  run.input.categories.filter((category) => run.places?.some((place) => place.category === category));

// Moves a place that fits a missing category too (a pub counted as a restaurant is also a
// bar) into it, as long as the category it leaves still has another place
function fillMissing(places: Place[], missing: Category[]) {
  for (const category of missing) {
    const spare = places.find(
      (place) => place.fits.includes(category) && places.filter((other) => other.category === place.category).length > 1,
    );
    if (spare) spare.category = category;
  }
}

// Fills the markers in a step's prompt text
function fillMarkers(text: string, run: Run) {
  const values: Record<string, string> = {
    purpose: run.input.purpose || "anything fun",
    budget: run.input.budget,
    start: run.input.neighborhood,
    places: placeList(run.places ?? []),
    pick: pickRule(run.picked),
    plan: run.plan ? JSON.stringify(run.plan, null, 2) : "",
  };
  return text.replace(/\{(purpose|budget|start|places|pick|plan)\}/g, (_, key: string) => values[key]);
}

// Places grouped under category headings, numbered across the whole list
function placeList(places: Place[]) {
  return (Object.keys(CATEGORIES) as Category[])
    .filter((category) => places.some((place) => place.category === category))
    .map((category) => {
      const lines = places.flatMap((place, i) =>
        place.category === category
          ? [
              [
                `${i + 1}. ${place.name}`,
                place.kind,
                place.rating && `★ ${place.rating}${place.ratingCount ? ` (${place.ratingCount} reviews)` : ""}`,
                place.price && `price ${place.price}`,
                `${place.miles} mi away`,
              ]
                .filter(Boolean)
                .join(" | "),
            ]
          : [],
      );
      return `${CATEGORIES[category].label}:\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

// How many places to pick, and from which categories
function pickRule(required: Category[]) {
  const names = required.map((category) => CATEGORIES[category].label);
  const { min, max } = STOPS;
  const count = (low: number) => (low === max ? `exactly ${max}` : `${low} or ${max}`);
  if (required.length === 0) return `Pick ${count(min)} different places, from different categories when you can.`;
  if (required.length === 1) return `Pick ${count(min)} different places, all from ${names[0]}.`;
  if (required.length <= max) {
    return `Pick ${count(Math.max(min, required.length))} different places, only from ${names.join(", ")}, with at least one from each of them.`;
  }
  return `Pick exactly ${max} different places from ${max} different categories among ${names.join(", ")}: the ones that fit the request best.`;
}

// Enforce the plan rules, trimming extras. Returns null when the plan can't satisfy them.
function checkStops(plan: GeminiPlan | null, places: Place[], picked: Category[]): GeminiPlan | null {
  if (!plan) return null;
  const { min, max } = STOPS;
  const categoryOf = (stop: GeminiPlan["stops"][number]) => places[stop.place - 1].category;

  // The same place twice → keep the first
  const seenPlaces = new Set<number>();
  let stops = plan.stops.filter((stop) => {
    if (seenPlaces.has(stop.place)) return false;
    seenPlaces.add(stop.place);
    return true;
  });

  // Nothing picked: min–max places of any kind
  if (picked.length === 0) {
    stops = stops.slice(0, max);
    return stops.length >= min ? { ...plan, stops } : null;
  }

  stops = stops.filter((stop) => picked.includes(categoryOf(stop)));

  // More picked than stops fit: `max` places, each from a different picked category
  if (picked.length > max) {
    const seen = new Set<Category>();
    stops = stops
      .filter((stop) => {
        if (seen.has(categoryOf(stop))) return false;
        seen.add(categoryOf(stop));
        return true;
      })
      .slice(0, max);
    return stops.length === max ? { ...plan, stops } : null;
  }

  // Otherwise: only picked categories, each at least once
  stops = stops.slice(0, max);
  const covered = picked.every((category) => stops.some((stop) => categoryOf(stop) === category));
  return stops.length >= Math.max(min, picked.length) && covered ? { ...plan, stops } : null;
}

const labels = (categories: Category[], join = ", ") => categories.map((category) => CATEGORIES[category].label).join(join);

// "Coffee 5, Restaurants 12"
function countByCategory(places: Place[]) {
  const counts = (Object.keys(CATEGORIES) as Category[])
    .map((category) => [category, places.filter((place) => place.category === category).length] as const)
    .filter(([, n]) => n > 0)
    .map(([category, n]) => `${CATEGORIES[category].label} ${n}`);
  return counts.join(", ") || "none";
}

function toRunPlan(plan: GeminiPlan, places: Place[]): RunPlan {
  return {
    title: plan.title,
    tip: plan.tip,
    stops: plan.stops.map((stop) => {
      const place = places[stop.place - 1];
      return {
        name: place.name,
        category: CATEGORIES[place.category].label,
        minutes: stop.minutes,
        note: stop.note,
        mapsUrl: place.mapsUrl,
      };
    }),
  };
}

// Same log as OutNYC: the request (with the chain) and every AI call. A failed log never stops the run.
async function logRequest(supabase: Supabase, chainId: number, run: Run, failure: string | null, ms: number) {
  const { input } = run;
  try {
    const { data: request, error } = await supabase
      .from("generation_requests")
      .insert({
        chain_id: chainId,
        neighborhood: input.neighborhood,
        inputs: { radiusMiles: input.radiusMiles, categories: input.categories, purpose: input.purpose, budget: input.budget, openNow: input.openNow },
        status: failure ? "failed" : "success",
        error: failure,
        plan_id: run.planId,
        duration_ms: ms,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (run.attempts.length === 0) return;
    const { error: responsesError } = await supabase.from("llm_responses").insert(
      run.attempts.map((attempt) => ({
        request_id: request.id,
        model: attempt.model,
        ok: attempt.ok,
        http_status: attempt.httpStatus,
        response_text: attempt.text,
        duration_ms: attempt.ms,
      })),
    );
    if (responsesError) throw responsesError;
  } catch (err) {
    console.error("runChain: logging failed", err);
  }
}
