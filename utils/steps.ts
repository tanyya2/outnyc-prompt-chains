// The six kinds of step (the database allows only these, see sql/prompt-chain-tool.sql)
export const KINDS = {
  google_places: "Google search",
  filter: "Drop closed places",
  prompt: "Build the prompt",
  llm_call: "Ask AI",
  check: "Check the plan",
  save: "Save the plan",
} as const;

export type Kind = keyof typeof KINDS;

export const kindLabel = (kind: string) => KINDS[kind as Kind] ?? kind;

// "Ask AI" sends the prompt; "Check the plan" asks once more when the reply breaks the rules
export const usesAI = (kind: string) => kind === "llm_call" || kind === "check";

// Model and temperature only matter for steps that call the AI
export const hasModel = (kind: string) => kind === "llm_call";

// Steps that hold prompt text
export const hasPrompt = (kind: string) => kind === "prompt" || kind === "llm_call";

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
