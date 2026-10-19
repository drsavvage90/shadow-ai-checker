import { questionBank, questionsInFlow, type Question } from "@shadow-ai/core";

export type PersistedQuiz = {
  version: 2;
  step: number;
  answers: Record<string, string | string[]>;
};

const KEY = "shadow-ai-checker.v2";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAnswered(question: Question, answers: Record<string, string | string[]>): boolean {
  const value = answers[question.id];
  if (question.kind === "single") {
    return typeof value === "string" && question.choices.some((choice) => choice.id === value);
  }
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((id) => question.choices.some((choice) => choice.id === id))
  );
}

export function firstOpenStep(answers: Record<string, string | string[]>): number {
  const flow = questionsInFlow(answers);
  const index = flow.findIndex((question) => !isAnswered(question, answers));
  return index === -1 ? flow.length : index;
}

export function parseStored(raw: string | null): PersistedQuiz | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 2) return null;
    if (typeof value.step !== "number" || !Number.isInteger(value.step)) return null;
    if (!isRecord(value.answers)) return null;
    const answers: Record<string, string | string[]> = {};
    for (const question of questionBank.questions) {
      const stored = value.answers[question.id];
      if (question.kind === "single" && typeof stored === "string") {
        if (question.choices.some((choice) => choice.id === stored)) answers[question.id] = stored;
      } else if (question.kind === "multi" && Array.isArray(stored)) {
        const ids = stored.filter(
          (id): id is string => typeof id === "string" && question.choices.some((choice) => choice.id === id),
        );
        if (ids.length > 0) answers[question.id] = ids;
      }
    }
    const step = Math.min(Math.max(value.step, -1), questionsInFlow(answers).length);
    return { version: 2, step, answers };
  } catch {
    return null;
  }
}

export function loadQuiz(): PersistedQuiz | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return parseStored(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveQuiz(state: PersistedQuiz): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing can refuse storage. The assessment still runs in memory.
  }
}

export function clearQuiz(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing persisted.
  }
}
