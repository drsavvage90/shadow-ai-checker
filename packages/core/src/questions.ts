import {
  APPALACHIAN_STATE_IDS,
  INVENTORY_QUESTION_ID,
  PROFILE_QUESTION_IDS,
  SEGMENT_IDS,
} from "./brand.js";
import questionsRaw from "./data/questions.json";
import { CatalogError } from "./services.js";
import type {
  Category,
  CategoryId,
  Choice,
  Fix,
  FixPriority,
  Question,
  QuestionBank,
  QuestionKind,
  QuestionRole,
} from "./types.js";

const CATEGORY_IDS: readonly CategoryId[] = ["tools", "data", "policy", "training", "accounts"];
const ROLES: readonly QuestionRole[] = ["profile", "inventory", "scored"];
const KINDS: readonly QuestionKind[] = ["single", "multi"];
const PRIORITIES: readonly FixPriority[] = ["now", "soon", "later"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFix(raw: unknown, questionId: string): Fix {
  if (!isRecord(raw)) throw new CatalogError(`Question ${questionId} has a fix that is not an object.`);
  const id = raw.id;
  const priority = raw.priority;
  const title = raw.title;
  const detail = raw.detail;
  if (typeof id !== "string" || !/^[a-z0-9-]{3,64}$/.test(id)) {
    throw new CatalogError(`Question ${questionId} has an invalid fix id.`);
  }
  if (typeof priority !== "string" || !PRIORITIES.includes(priority as FixPriority)) {
    throw new CatalogError(`Question ${questionId} has an invalid fix priority.`);
  }
  if (typeof title !== "string" || title.trim().length < 8) {
    throw new CatalogError(`Question ${questionId} has a short fix title.`);
  }
  if (typeof detail !== "string" || detail.trim().length < 20) {
    throw new CatalogError(`Question ${questionId} has a short fix detail.`);
  }
  return {
    id,
    priority: priority as FixPriority,
    title: title.trim(),
    detail: detail.trim(),
  };
}

function parseChoice(raw: unknown, question: { id: string; role: QuestionRole }): Choice {
  if (!isRecord(raw)) throw new CatalogError(`Question ${question.id} has a choice that is not an object.`);
  const id = raw.id;
  const label = raw.label;
  if (typeof id !== "string" || !/^[a-z0-9-]{1,40}$/.test(id)) {
    throw new CatalogError(`Question ${question.id} has an invalid choice id.`);
  }
  if (typeof label !== "string" || label.trim().length < 2) {
    throw new CatalogError(`Question ${question.id} has an empty choice label.`);
  }
  const choice: Choice = { id, label: label.trim() };
  if (raw.exclusive !== undefined) {
    if (typeof raw.exclusive !== "boolean") {
      throw new CatalogError(`Question ${question.id} has a bad exclusive flag.`);
    }
    if (raw.exclusive) choice.exclusive = true;
  }
  if (question.role === "scored") {
    if (typeof raw.risk !== "number" || !Number.isInteger(raw.risk) || raw.risk < 0 || raw.risk > 4) {
      throw new CatalogError(`Question ${question.id} choices need an integer risk from 0 to 4.`);
    }
    choice.risk = raw.risk;
  } else if (raw.risk !== undefined) {
    throw new CatalogError(`Question ${question.id} is not scored and must not set risk.`);
  }
  if (raw.fix !== undefined) {
    if (question.role !== "scored") {
      throw new CatalogError(`Question ${question.id} is not scored and must not include a fix.`);
    }
    choice.fix = parseFix(raw.fix, question.id);
  }
  return choice;
}

export function parseQuestionBank(raw: unknown): QuestionBank {
  if (!isRecord(raw) || typeof raw.version !== "number" || !Array.isArray(raw.categories) || !Array.isArray(raw.questions)) {
    throw new CatalogError("Question bank must include version, categories, and questions.");
  }
  if (raw.categories.length !== CATEGORY_IDS.length) {
    throw new CatalogError("Question bank is missing a category.");
  }
  const categories: Category[] = [];
  const seenCategories = new Set<string>();
  let weight = 0;
  for (const entry of raw.categories) {
    if (!isRecord(entry)) throw new CatalogError("Each category must be an object.");
    const id = entry.id;
    const title = entry.title;
    const categoryWeight = entry.weight;
    const description = entry.description;
    if (typeof id !== "string" || !CATEGORY_IDS.includes(id as CategoryId)) {
      throw new CatalogError(`Unknown category id: ${String(id)}`);
    }
    if (seenCategories.has(id)) throw new CatalogError(`Duplicate category: ${id}`);
    seenCategories.add(id);
    if (typeof title !== "string" || title.trim().length < 3) {
      throw new CatalogError(`Category ${id} needs a title.`);
    }
    if (typeof categoryWeight !== "number" || categoryWeight <= 0 || categoryWeight > 1) {
      throw new CatalogError(`Category ${id} has a bad weight.`);
    }
    if (typeof description !== "string" || description.trim().length < 12) {
      throw new CatalogError(`Category ${id} needs a description.`);
    }
    weight += categoryWeight;
    categories.push({
      id: id as CategoryId,
      title: title.trim(),
      weight: categoryWeight,
      description: description.trim(),
    });
  }
  if (Math.abs(weight - 1) > 0.001) {
    throw new CatalogError(`Category weights must sum to 1. They sum to ${weight}.`);
  }

  const questions: Question[] = [];
  const seenIds = new Set<string>();
  for (const entry of raw.questions) {
    if (!isRecord(entry)) throw new CatalogError("Each question must be an object.");
    const id = entry.id;
    const role = entry.role;
    const kind = entry.kind;
    const section = entry.section;
    const prompt = entry.prompt;
    if (typeof id !== "string" || !/^[a-z0-9.-]{3,64}$/.test(id)) {
      throw new CatalogError(`Invalid question id: ${String(id)}`);
    }
    if (seenIds.has(id)) throw new CatalogError(`Duplicate question id: ${id}`);
    seenIds.add(id);
    if (typeof role !== "string" || !ROLES.includes(role as QuestionRole)) {
      throw new CatalogError(`Question ${id} has an unknown role.`);
    }
    if (typeof kind !== "string" || !KINDS.includes(kind as QuestionKind)) {
      throw new CatalogError(`Question ${id} has an unknown kind.`);
    }
    if (typeof section !== "string" || section.trim().length < 3) {
      throw new CatalogError(`Question ${id} needs a section.`);
    }
    if (typeof prompt !== "string" || prompt.trim().length < 10) {
      throw new CatalogError(`Question ${id} needs a longer prompt.`);
    }
    const questionRole = role as QuestionRole;
    let category: CategoryId | undefined;
    if (questionRole === "scored") {
      if (typeof entry.category !== "string" || !CATEGORY_IDS.includes(entry.category as CategoryId)) {
        throw new CatalogError(`Scored question ${id} needs a category.`);
      }
      category = entry.category as CategoryId;
    } else if (entry.category !== undefined) {
      throw new CatalogError(`Question ${id} is not scored and must not set a category.`);
    }
    if (!Array.isArray(entry.choices) || entry.choices.length < 2) {
      throw new CatalogError(`Question ${id} needs at least two choices.`);
    }
    const choices = entry.choices.map((choice) => parseChoice(choice, { id, role: questionRole }));
    const choiceIds = new Set<string>();
    for (const choice of choices) {
      if (choiceIds.has(choice.id)) throw new CatalogError(`Question ${id} repeats choice ${choice.id}.`);
      choiceIds.add(choice.id);
    }
    if (questionRole === "scored") {
      const risks = choices.map((choice) => choice.risk ?? 0);
      if (!risks.some((value) => value === 0)) {
        throw new CatalogError(`Scored question ${id} needs a zero-risk choice.`);
      }
      if (!risks.some((value) => value >= 3)) {
        throw new CatalogError(`Scored question ${id} needs a high-risk choice.`);
      }
    }
    const hint = entry.hint;
    if (hint !== undefined && (typeof hint !== "string" || hint.trim().length < 8)) {
      throw new CatalogError(`Question ${id} has an unusable hint.`);
    }
    const question: Question = {
      id,
      role: questionRole,
      kind: kind as QuestionKind,
      section: section.trim(),
      prompt: prompt.trim(),
      choices,
    };
    if (category) question.category = category;
    if (typeof hint === "string") question.hint = hint.trim();
    questions.push(question);
  }

  const byId = new Map(questions.map((question) => [question.id, question]));
  const segment = byId.get(PROFILE_QUESTION_IDS.segment);
  const size = byId.get(PROFILE_QUESTION_IDS.size);
  const states = byId.get(PROFILE_QUESTION_IDS.states);
  const inventory = byId.get(INVENTORY_QUESTION_ID);
  if (!segment || segment.role !== "profile" || segment.kind !== "single") {
    throw new CatalogError("Profile segment question is missing.");
  }
  if (!size || size.role !== "profile" || size.kind !== "single") {
    throw new CatalogError("Profile size question is missing.");
  }
  if (!states || states.role !== "profile" || states.kind !== "multi") {
    throw new CatalogError("Profile states question is missing.");
  }
  if (!inventory || inventory.role !== "inventory" || inventory.kind !== "multi") {
    throw new CatalogError("Tool inventory question is missing.");
  }
  const segmentIds = segment.choices.map((choice) => choice.id).sort();
  const expectedSegments = [...SEGMENT_IDS].sort();
  if (segmentIds.join(",") !== expectedSegments.join(",")) {
    throw new CatalogError("Segment choices must match the segment ids used by the report.");
  }
  for (const stateId of APPALACHIAN_STATE_IDS) {
    if (!states.choices.some((choice) => choice.id === stateId)) {
      throw new CatalogError(`States question is missing ${stateId}.`);
    }
  }
  for (const categoryId of CATEGORY_IDS) {
    if (!questions.some((question) => question.category === categoryId)) {
      throw new CatalogError(`No scored question in category ${categoryId}.`);
    }
  }

  return { version: raw.version, categories, questions };
}

export const questionBank: QuestionBank = parseQuestionBank(questionsRaw);
