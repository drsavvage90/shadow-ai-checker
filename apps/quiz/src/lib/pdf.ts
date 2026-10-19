import { BRAND, type AssessmentResult } from "@shadow-ai/core";
import { jsPDF } from "jspdf";

const NAVY: [number, number, number] = [28, 36, 48];
const BRASS: [number, number, number] = [140, 90, 46];
const MUTED: [number, number, number] = [68, 80, 102];
const RULE: [number, number, number] = [217, 209, 195];

const PRIORITY_LABEL = { now: "Do now", soon: "Do soon", later: "Do later" } as const;

export function buildReportDocument(
  result: AssessmentResult,
  meta: { partner: string | null; generatedAt: Date },
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const width = pageWidth - margin * 2;
  let y = 40;

  const ensure = (needed: number) => {
    if (y + needed <= pageHeight - 46) return;
    doc.addPage();
    y = margin;
  };

  const write = (
    value: string,
    size: number,
    font: "times" | "helvetica",
    style: "normal" | "bold" | "italic",
    color: [number, number, number],
    gap = 6,
  ) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(value, width) as string[];
    const lineHeight = size + 3;
    ensure(lines.length * lineHeight + gap);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + gap;
  };

  const rule = () => {
    ensure(16);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + width, y);
    y += 14;
  };

  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageWidth, 8, "F");

  write(BRAND.name, 22, "times", "bold", NAVY, 2);
  write(`by ${BRAND.maker}`, 11, "helvetica", "normal", BRASS, 2);
  if (meta.partner) write(`In partnership with ${meta.partner}.`, 11, "helvetica", "normal", MUTED, 2);
  write(
    meta.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    10,
    "helvetica",
    "normal",
    MUTED,
    8,
  );
  rule();

  write(`${result.bandTitle}: ${result.overallScore} out of 100`, 16, "times", "bold", NAVY, 4);
  write(result.bandSummary, 11, "helvetica", "normal", NAVY, 6);
  write(
    `Based on ${result.scoredAnswered} of ${result.scoredTotal} scored questions. This self-assessment helps reduce risk. It is not a legal opinion.`,
    10,
    "helvetica",
    "italic",
    MUTED,
    8,
  );

  const profileBits = [
    result.profile.segmentLabel ? `Business: ${result.profile.segmentLabel}` : null,
    result.profile.staffSizeLabel ? `People: ${result.profile.staffSizeLabel}` : null,
    result.profile.stateLabels.length > 0 ? `Operates in: ${result.profile.stateLabels.join(", ")}` : null,
  ].filter((line): line is string => Boolean(line));
  for (const line of profileBits) write(line, 11, "helvetica", "normal", NAVY, 2);
  if (profileBits.length > 0) y += 6;
  if (result.profile.appalachianStates) {
    write(
      "You noted Ohio, Kentucky, or West Virginia. The suggestions are written with small firms in those states in mind. Devices the firm does not manage are still outside what this checker can see.",
      10,
      "helvetica",
      "normal",
      MUTED,
      6,
    );
  }
  if (result.hipaaNote) write(result.hipaaNote, 10, "helvetica", "normal", MUTED, 6);

  write("Risk by category", 14, "times", "bold", NAVY, 8);
  const categories = [...result.categories].sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
  for (const category of categories) {
    ensure(36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(`${category.title}  ·  ${category.score}  ·  ${category.bandTitle}`, margin, y);
    y += 8;
    doc.setFillColor(RULE[0], RULE[1], RULE[2]);
    doc.rect(margin, y, width, 6, "F");
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(margin, y, Math.max(2, (width * category.score) / 100), 6, "F");
    y += 16;
    write(category.description, 10, "helvetica", "normal", MUTED, 6);
  }

  write("Tools you reported", 14, "times", "bold", NAVY, 4);
  write(result.tools.length > 0 ? result.tools.join(", ") : "No tools were selected.", 11, "helvetica", "normal", NAVY, 8);

  write("Prioritized fixes", 14, "times", "bold", NAVY, 6);
  if (result.fixes.length === 0) {
    write("No fixes came out of these answers. Keep the tool list current when staff or products change.", 11, "helvetica", "normal", NAVY, 8);
  }
  result.fixes.forEach((fix, index) => {
    write(`${index + 1}. ${PRIORITY_LABEL[fix.priority]} — ${fix.title}`, 12, "helvetica", "bold", NAVY, 2);
    write(fix.detail, 11, "helvetica", "normal", NAVY, 8);
  });

  write("What this does not cover", 14, "times", "bold", NAVY, 4);
  for (const limitation of result.limitations) write(`• ${limitation}`, 10, "helvetica", "normal", MUTED, 4);
  y += 6;

  write("Next step", 14, "times", "bold", NAVY, 4);
  write(result.cta.body, 11, "helvetica", "normal", NAVY, 4);
  write(result.cta.label, 11, "helvetica", "bold", BRASS, 2);
  write(result.cta.href, 9, "helvetica", "normal", MUTED, 8);

  write("Your answers", 14, "times", "bold", NAVY, 6);
  for (const answer of result.answers) {
    write(answer.prompt, 11, "helvetica", "bold", NAVY, 2);
    write(answer.labels.length > 0 ? answer.labels.join("; ") : "Not answered", 10, "helvetica", "normal", MUTED, 6);
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${BRAND.name} by ${BRAND.maker}  ·  ${BRAND.makerUrl}`, margin, pageHeight - 28);
    doc.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 28, { align: "right" });
  }

  return doc;
}

export async function downloadReport(
  result: AssessmentResult,
  meta: { partner: string | null; generatedAt: Date },
): Promise<void> {
  buildReportDocument(result, meta).save("shadow-ai-risk-report.pdf");
}
