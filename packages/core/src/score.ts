import {
  APPALACHIAN_STATE_IDS,
  ctaForSegment,
  INVENTORY_QUESTION_ID,
  isSegmentId,
  LIMITATIONS,
  PROFILE_QUESTION_IDS,
} from "./brand.js";
import { questionApplies, questionBank as defaultBank, readProfileChoice } from "./questions.js";
import { buildRulesReport, weightsForProfession } from "./rules.js";
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
      "On these answers, more of the permission and behavior basics are in place. This helps reduce risk only if the policy, the approved tool, and the training stay current.",
  },
  moderate: {
    title: "Moderate risk",
    summary:
      "Some of the permission and behavior basics are in place, and some are missing. Start with the gaps under your rules, then the fixes marked Do now.",
  },
  elevated: {
    title: "Elevated risk",
    summary:
      "Important gaps showed up in whether AI use is permitted in practice, or in whether staff will stay on the approved tool. Start with the items marked Do now.",
  },
  high: {
    title: "High risk",
    summary:
      "The answers describe wide-open use: little written permission, and little reason for staff to stay on an approved tool. Start with the items marked Do now. This result helps reduce risk. It is not a finding that a law was broken.",
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

function answerRisk(question: Question, answers: Answers): number | null {
  const selected = selectedChoices(question, answers);
  if (!selected) return null;
  if (question.kind === "multi") return Math.max(...selected.map((choice) => choiceRisk(choice)));
  return choiceRisk(selected[0] ?? { id: "", label: "" });
}

export function scoreAssessment(
  answers: Answers,
  bank: QuestionBank = defaultBank,
): AssessmentResult {
  const profileIds = readProfileChoice(answers, bank);
  const profileWeights = weightsForProfession(profileIds.professionId);
  const applies = (question: Question) => questionApplies(question, profileIds.professionId, profileIds.stateId);

  const categories: CategoryScore[] = [];
  for (const category of bank.categories) {
    const weight = profileWeights[category.id] ?? 0;
    if (weight <= 0) continue;
    const questions = bank.questions.filter((question) => question.category === category.id && applies(question));
    let riskSum = 0;
    let maxSum = 0;
    let answered = 0;
    for (const question of questions) {
      const risk = answerRisk(question, answers);
      if (risk === null) continue;
      const maxRisk = Math.max(...question.choices.map((choice) => choiceRisk(choice)));
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
      weight,
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
    if (question.role !== "scored" || !applies(question)) continue;
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
  const visibleQuestions = bank.questions.filter((question) => applies(question));
  const answerRecords: AnswerRecord[] = visibleQuestions.map((question) => ({
    questionId: question.id,
    section: question.section,
    prompt: question.prompt,
    labels: labelsFor(question, answers),
  }));
  const scoredQuestions = visibleQuestions.filter((question) => question.role === "scored");
  const scoredTotal = scoredQuestions.length;
  const scoredAnswered = scoredQuestions.filter((question) => answerRisk(question, answers) !== null).length;
  const rules = buildRulesReport({
    professionId: profileIds.professionId,
    stateId: profileIds.stateId,
    questionRisk: (questionId) => {
      const question = bank.questions.find((item) => item.id === questionId);
      if (!question || !applies(question)) return null;
      return answerRisk(question, answers);
    },
  });

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
    rules,
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
  const stateChoice = statesQuestion ? selectedChoices(statesQuestion, answers)?.[0] : undefined;
  return {
    segmentId: segmentChoice?.id ?? null,
    segmentLabel: segmentChoice?.label ?? null,
    staffSizeLabel: sizeChoice?.label ?? null,
    stateLabels: stateChoice ? [stateChoice.label] : [],
    appalachianStates: APPALACHIAN_STATE_IDS.some((id) => id === stateChoice?.id),
  };
}

export function categoryOrder(): CategoryId[] {
  return ["permission", "behavior", "verification", "data"];
}
