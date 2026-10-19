import {
  APPALACHIAN_STATE_IDS,
  ctaForSegment,
  INVENTORY_QUESTION_ID,
  isSegmentId,
  LIMITATIONS,
  PROFILE_QUESTION_IDS,
} from "./brand.js";
import { questionBank as defaultBank } from "./questions.js";
import type {
  AnswerRecord,
  Answers,
  AssessmentResult,
  CategoryId,
  CategoryScore,
  Choice,
  FixPriority,
  ProfileSummary,
  Question,
  QuestionBank,
  ReportFix,
  RiskBand,
} from "./types.js";

const PRIORITY_RANK: Record<FixPriority, number> = { now: 0, soon: 1, later: 2 };

const BANDS: Record<RiskBand, { title: string; summary: string }> = {
  low: {
    title: "Lower risk",
    summary:
      "On the answers given, more of the basics are in place. This helps reduce risk only if the tool list stays current when staff or products change.",
  },
  moderate: {
    title: "Moderate risk",
    summary:
      "Some controls are in place and some are missing. The fixes are ordered so a small firm can close the gaps that matter first.",
  },
  elevated: {
    title: "Elevated risk",
    summary:
      "Important gaps showed up in how AI tools are used, what information goes into them, or who can still get in. Start with the items marked Do now.",
  },
  high: {
    title: "High risk",
    summary:
      "The answers describe wide-open use of AI tools. Pause new tools and start with the items marked Do now. This result helps reduce risk. It is not a finding that a law was broken.",
  },
};

export function bandFor(score: number): RiskBand {
  if (score >= 75) return "high";
  if (score >= 50) return "elevated";
  if (score >= 25) return "moderate";
  return "low";
}

function selectedChoices(question: Question, answers: Answers): Choice[] | null {
  const value = answers[question.id];
  if (question.kind === "single") {
    if (typeof value !== "string") return null;
    const choice = question.choices.find((item) => item.id === value);
    return choice ? [choice] : null;
  }
  if (!Array.isArray(value) || value.length === 0) return null;
  const choices: Choice[] = [];
  for (const id of value) {
    if (typeof id !== "string") return null;
    const choice = question.choices.find((item) => item.id === id);
    if (!choice) return null;
    choices.push(choice);
  }
  return choices;
}

function labelsFor(question: Question, answers: Answers): string[] {
  return selectedChoices(question, answers)?.map((choice) => choice.label) ?? [];
}

function choiceRisk(choice: Choice): number {
  return choice.risk ?? 0;
}

export function scoreAssessment(
  answers: Answers,
  bank: QuestionBank = defaultBank,
): AssessmentResult {
  const categories: CategoryScore[] = [];
  for (const category of bank.categories) {
    const questions = bank.questions.filter((question) => question.category === category.id);
    let riskSum = 0;
    let maxSum = 0;
    let answered = 0;
    for (const question of questions) {
      const selected = selectedChoices(question, answers);
      if (!selected) continue;
      const maxRisk = Math.max(...question.choices.map((choice) => choiceRisk(choice)));
      const risk =
        question.kind === "multi"
          ? Math.max(...selected.map((choice) => choiceRisk(choice)))
          : choiceRisk(selected[0] ?? { id: "", label: "" });
      riskSum += risk;
      maxSum += maxRisk;
      answered += 1;
    }
    if (answered === 0 || maxSum === 0) continue;
    const score = Math.round((riskSum / maxSum) * 100);
    const band = bandFor(score);
    categories.push({
      id: category.id,
      title: category.title,
      description: category.description,
      score,
      band,
      bandTitle: BANDS[band].title,
      weight: category.weight,
      answered,
    });
  }

  const weightSum = categories.reduce((sum, category) => sum + category.weight, 0);
  const overallScore =
    weightSum === 0
      ? 0
      : Math.round(categories.reduce((sum, category) => sum + category.score * category.weight, 0) / weightSum);
  const band = bandFor(overallScore);

  const fixes = new Map<string, ReportFix>();
  for (const question of bank.questions) {
    if (question.role !== "scored") continue;
    const selected = selectedChoices(question, answers);
    if (!selected) continue;
    for (const choice of selected) {
      if (!choice.fix) continue;
      const next: ReportFix = {
        ...choice.fix,
        category: question.category ?? null,
      };
      const existing = fixes.get(next.id);
      if (!existing || PRIORITY_RANK[next.priority] < PRIORITY_RANK[existing.priority]) {
        fixes.set(next.id, next);
      }
    }
  }
  const orderedFixes = [...fixes.values()].sort(
    (left, right) => PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] || left.title.localeCompare(right.title),
  );

  const profile = buildProfile(bank, answers);
  const inventory = bank.questions.find((question) => question.id === INVENTORY_QUESTION_ID);
  const tools = inventory ? labelsFor(inventory, answers) : [];
  const answerRecords: AnswerRecord[] = bank.questions.map((question) => ({
    questionId: question.id,
    section: question.section,
    prompt: question.prompt,
    labels: labelsFor(question, answers),
  }));
  const scoredTotal = bank.questions.filter((question) => question.role === "scored").length;
  const scoredAnswered = bank.questions.filter(
    (question) => question.role === "scored" && selectedChoices(question, answers),
  ).length;

  return {
    version: bank.version,
    overallScore,
    band,
    bandTitle: BANDS[band].title,
    bandSummary: BANDS[band].summary,
    categories,
    fixes: orderedFixes,
    profile,
    tools,
    answers: answerRecords,
    limitations: [...LIMITATIONS],
    cta: ctaForSegment(isSegmentId(profile.segmentId) ? profile.segmentId : null),
    hipaaNote:
      profile.segmentId === "healthcare"
        ? "You identified a healthcare practice. The fixes here are HIPAA-aligned habits. They do not settle the practice's HIPAA duties."
        : null,
    scoredAnswered,
    scoredTotal,
  };
}

function buildProfile(bank: QuestionBank, answers: Answers): ProfileSummary {
  const segmentQuestion = bank.questions.find((question) => question.id === PROFILE_QUESTION_IDS.segment);
  const sizeQuestion = bank.questions.find((question) => question.id === PROFILE_QUESTION_IDS.size);
  const statesQuestion = bank.questions.find((question) => question.id === PROFILE_QUESTION_IDS.states);
  const segmentChoice = segmentQuestion ? selectedChoices(segmentQuestion, answers)?.[0] : undefined;
  const sizeChoice = sizeQuestion ? selectedChoices(sizeQuestion, answers)?.[0] : undefined;
  const stateChoices = statesQuestion ? selectedChoices(statesQuestion, answers) ?? [] : [];
  const stateIds = new Set(stateChoices.map((choice) => choice.id));
  return {
    segmentId: segmentChoice?.id ?? null,
    segmentLabel: segmentChoice?.label ?? null,
    staffSizeLabel: sizeChoice?.label ?? null,
    stateLabels: stateChoices.map((choice) => choice.label),
    appalachianStates: APPALACHIAN_STATE_IDS.some((id) => stateIds.has(id)),
  };
}

export function categoryOrder(): CategoryId[] {
  return ["data", "accounts", "policy", "tools", "training"];
}
