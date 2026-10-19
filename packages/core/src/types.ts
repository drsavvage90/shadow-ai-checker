export type ServiceCategory =
  | "chat"
  | "search"
  | "writing"
  | "coding"
  | "meeting"
  | "image"
  | "platform";

export type Signal = "high" | "medium" | "low";

export type Channel = "dns" | "extension";

export type AiService = {
  id: string;
  name: string;
  vendor: string;
  category: ServiceCategory;
  signal: Signal;
  channels: Channel[];
  domains: string[];
  note?: string;
};

export type PatternId =
  | "ssn"
  | "credit_card"
  | "email"
  | "phone"
  | "phi_hint"
  | "client_matter";

export type PatternSeverity = "high" | "low";

export type SensitiveFinding = {
  id: PatternId;
  label: string;
  severity: PatternSeverity;
  count: number;
};

export type CategoryId = "permission" | "behavior" | "verification" | "data";

export type QuestionRole = "profile" | "inventory" | "scored";

export type QuestionKind = "single" | "multi";

export type FixPriority = "now" | "soon" | "later";

export type Fix = {
  id: string;
  priority: FixPriority;
  title: string;
  detail: string;
};

export type Choice = {
  id: string;
  label: string;
  risk?: number;
  exclusive?: boolean;
  fix?: Fix;
};

export type Category = {
  id: CategoryId;
  title: string;
  weight: number;
  description: string;
};

export type AppliesTo = {
  professions?: string[];
  states?: string[];
};

export type Question = {
  id: string;
  role: QuestionRole;
  kind: QuestionKind;
  section: string;
  category?: CategoryId;
  prompt: string;
  hint?: string;
  choices: Choice[];
  appliesTo?: AppliesTo;
};

export type QuestionBank = {
  version: number;
  categories: Category[];
  questions: Question[];
};

export type RiskBand = "low" | "moderate" | "elevated" | "high";

export type Answers = Readonly<Record<string, string | readonly string[]>>;

export type CategoryScore = {
  id: CategoryId;
  title: string;
  description: string;
  score: number;
  band: RiskBand;
  bandTitle: string;
  weight: number;
  answered: number;
};

export type ReportFix = Fix & {
  category: CategoryId | null;
};

export type ProfileSummary = {
  segmentId: string | null;
  segmentLabel: string | null;
  staffSizeLabel: string | null;
  stateLabels: string[];
  appalachianStates: boolean;
};

export type AnswerRecord = {
  questionId: string;
  section: string;
  prompt: string;
  labels: string[];
};

export type CallToAction = {
  label: string;
  href: string;
  body: string;
};

export type RuleCitation = {
  id: string;
  summary: string;
  citation: string;
  url: string;
};

export type RuleGap = RuleCitation & {
  detail: string;
};

export type RuleNote = {
  id: string;
  summary: string;
};

export type RuleExample = {
  intro: string;
  summary: string;
  citation: string;
  url: string;
  newsSummary: string;
  newsCitation: string;
  newsUrl: string;
};

export type RulesReport = {
  notLegalAdvice: string;
  stateId: string | null;
  stateName: string | null;
  professionId: string | null;
  professionName: string | null;
  expectations: RuleCitation[];
  gaps: RuleGap[];
  notes: RuleNote[];
  example: RuleExample | null;
};

export type AssessmentResult = {
  version: number;
  overallScore: number;
  band: RiskBand;
  bandTitle: string;
  bandSummary: string;
  categories: CategoryScore[];
  fixes: ReportFix[];
  profile: ProfileSummary;
  tools: string[];
  answers: AnswerRecord[];
  limitations: string[];
  cta: CallToAction;
  hipaaNote: string | null;
  rules: RulesReport;
  scoredAnswered: number;
  scoredTotal: number;
};

export type AnonymousCountSnapshot = {
  schema: "shadow-ai-counts.v1";
  since: string;
  generatedAt: string;
  visitsByService: Record<string, number>;
  warningsByPattern: Record<string, number>;
};

export interface AnonymousCountSink {
  send(snapshot: AnonymousCountSnapshot): Promise<void>;
}
