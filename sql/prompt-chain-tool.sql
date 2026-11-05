-- Prompt chain tool, step 2: what a step can hold, and moving steps up and down.
-- Run once in the Supabase SQL Editor (OutNYC project). Safe to run again.

-- ─── What a step can hold ─────────────────────────────────────────────────────
-- prompt_text: the prompt for "Build the prompt" and for AI steps.
--   Markers filled in for each plan: {purpose} {budget} {start} {places} {pick}
-- model_id: the model an AI step uses. Empty = the active models in the admin's order.
-- temperature: 0 (predictable) to 2 (very creative). Empty = Gemini's own default.
alter table public.prompt_chain_steps
  add column if not exists prompt_text text,
  add column if not exists model_id bigint references public.llm_models (id) on delete set null,
  add column if not exists temperature numeric(3, 2) check (temperature between 0 and 2);

-- Only the six kinds of step the tool knows how to run
alter table public.prompt_chain_steps drop constraint if exists prompt_chain_steps_kind_check;
alter table public.prompt_chain_steps add constraint prompt_chain_steps_kind_check
  check (kind in ('google_places', 'filter', 'prompt', 'llm_call', 'check', 'save'));

-- "Build the prompt" of the OutNYC plan chain gets OutNYC's prompt, word for word as it is today
update public.prompt_chain_steps s
set prompt_text = $prompt$You are planning an outing in New York City for a college student.

Request:
- What for (may include the vibe they want): {purpose}
- Budget: {budget} ($ = cheap, $$ = moderate, $$$ = splurge)
- Starting point: {start}

Nearby places, with their Google rating and price (choose only from these, by number):
{places}

{pick} Choose the places that best fit what it's for and the budget, prefer well-rated ones, and put them in a sensible walking order.

Give each stop a realistic number of minutes for that kind of place and what the person will do there. Typical times: coffee or dessert 20–40, bookstore 20–45, restaurant 45–75, bar 45–90, club 60–120, park 30–60, museum or gallery 60–120.

For each stop, write a note of 1 to 3 short sentences saying specifically what to do there: what to order, see or try, and anything worth knowing. Be concrete and only say things you're confident are true about that place; if you don't know it well, describe what to do there in general terms.

Reply with only JSON, no other text:
{"title": string (max 8 words), "stops": [{"place": number, "minutes": number, "note": string (1–3 sentences: what to do there)}], "tip": string (one short practical tip for the whole outing)}$prompt$
from public.prompt_chains c
where s.chain_id = c.id and c.name = 'OutNYC plan' and s.kind = 'prompt' and s.prompt_text is null;

-- ─── Moving a step up or down ─────────────────────────────────────────────────
-- Swaps a step with its neighbour in one go. (A chain can't have two steps with the
-- same number, so the step waits at 0 for a moment while the neighbour moves.)
-- security invoker: runs as the signed-in user, so only superadmins can change steps.
create or replace function public.move_prompt_chain_step(step_id bigint, direction text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  step record;
  neighbour record;
begin
  if not public.is_superadmin() then
    raise exception 'Only superadmins can move steps';
  end if;

  select id, chain_id, step_order into step from prompt_chain_steps where id = step_id;
  if not found then
    raise exception 'Step % not found', step_id;
  end if;

  if direction = 'up' then
    select id, step_order into neighbour from prompt_chain_steps
    where chain_id = step.chain_id and step_order < step.step_order
    order by step_order desc limit 1;
  elsif direction = 'down' then
    select id, step_order into neighbour from prompt_chain_steps
    where chain_id = step.chain_id and step_order > step.step_order
    order by step_order limit 1;
  else
    raise exception 'direction must be up or down';
  end if;
  -- Already first (or last): nothing to do
  if not found then
    return;
  end if;

  update prompt_chain_steps set step_order = 0 where id = step.id;
  update prompt_chain_steps set step_order = step.step_order where id = neighbour.id;
  update prompt_chain_steps set step_order = neighbour.step_order where id = step.id;
end;
$$;

revoke all on function public.move_prompt_chain_step(bigint, text) from public, anon;
grant execute on function public.move_prompt_chain_step(bigint, text) to authenticated;

notify pgrst, 'reload schema';

-- ─── Check ────────────────────────────────────────────────────────────────────
-- Should list the 6 steps; only "Build the prompt" has prompt text.
select s.step_order, s.name, s.kind, s.prompt_text is not null as has_prompt_text, s.model_id, s.temperature
from public.prompt_chain_steps s
join public.prompt_chains c on c.id = s.chain_id
where c.name = 'OutNYC plan'
order by s.step_order;
