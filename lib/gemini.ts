// Gemini calls and reading its reply, as in OutNYC (web/app/explore/gemini.ts),
// plus the step's temperature. Server-only: reads the API key.
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";

// `thinkingOff` skips extended reasoning (much faster); the lite model doesn't accept it
export type Model = { name: string; thinkingOff: boolean };

// What Gemini sends back: stops point at places by their number in the list
export type GeminiPlan = {
  title: string;
  stops: { place: number; minutes: number; note: string }[];
  tip: string;
};

// One call to one model, for the request log
export type GeminiAttempt = { model: string; ok: boolean; httpStatus: number; text: string; ms: number };

// Every model refused: out of free requests for today, or overloaded
export class GeminiBusyError extends Error {}

// Tries each model in turn (a model out of free requests refuses in well under a second).
// `temperature` null = Gemini's default. `attempts` collects every call made.
export async function askGemini(prompt: string, models: Model[], temperature: number | null, attempts: GeminiAttempt[]) {
  const failures: string[] = [];
  for (const model of models) {
    const generationConfig = {
      ...(temperature !== null && { temperature }),
      ...(model.thinkingOff && { thinkingConfig: { thinkingBudget: 0 } }),
    };
    const started = Date.now();
    const res = await fetch(`${GEMINI}/${model.name}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
      }),
    });
    if (!res.ok) {
      failures.push(`${model.name}: ${res.status}`);
      // Google's error message, shortened
      const error = (await res.text().catch(() => "")).slice(0, 2000);
      attempts.push({ model: model.name, ok: false, httpStatus: res.status, text: error, ms: Date.now() - started });
      continue;
    }

    const data = await res.json();
    const text: string = (data.candidates?.[0]?.content?.parts ?? []).map((part: { text?: string }) => part.text ?? "").join("");
    attempts.push({ model: model.name, ok: true, httpStatus: res.status, text, ms: Date.now() - started });
    return { text, model: model.name };
  }
  throw new GeminiBusyError(`All models refused: ${failures.join(", ") || "no models to try"}`);
}

// Pull the JSON out of Gemini's reply (it sometimes wraps it in ```json fences)
// and keep only stops that point at real places from the list.
export function parsePlan(text: string, placeCount: number): GeminiPlan | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const raw = JSON.parse(text.slice(start, end + 1));
    const stops = (Array.isArray(raw.stops) ? raw.stops : [])
      .filter((stop: { place: unknown }) => {
        const n = stop.place;
        return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= placeCount;
      })
      .map((stop: { place: number; minutes: unknown; note: unknown }) => ({
        place: stop.place,
        minutes: typeof stop.minutes === "number" ? Math.round(stop.minutes) : 30,
        note: String(stop.note ?? ""),
      }));
    if (stops.length === 0) return null;
    return { title: String(raw.title ?? "Your plan"), stops, tip: String(raw.tip ?? "") };
  } catch {
    return null;
  }
}
