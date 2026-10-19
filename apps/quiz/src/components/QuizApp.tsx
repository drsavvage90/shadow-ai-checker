"use client";

import {
  BRAND,
  LIMITATIONS,
  questionBank,
  sanitizePartner,
  scoreAssessment,
  type Question,
} from "@shadow-ai/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearQuiz, firstOpenStep, isAnswered, loadQuiz, saveQuiz } from "../lib/storage";

const PRIORITY_LABEL = { now: "Do now", soon: "Do soon", later: "Do later" } as const;

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="#1c2430" />
      <circle cx="16" cy="13" r="3.5" fill="#e8c48c" />
      <rect x="14.5" y="15.5" width="3" height="8" rx="1" fill="#e8c48c" />
    </svg>
  );
}

function toggleMulti(question: Question, current: string[], choiceId: string): string[] {
  const choice = question.choices.find((item) => item.id === choiceId);
  if (!choice) return current;
  if (choice.exclusive) return current.length === 1 && current[0] === choiceId ? [] : [choiceId];
  const withoutExclusive = current.filter((id) => !question.choices.find((item) => item.id === id)?.exclusive);
  if (withoutExclusive.includes(choiceId)) return withoutExclusive.filter((id) => id !== choiceId);
  return [...withoutExclusive, choiceId];
}

export function QuizApp() {
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [partner, setPartner] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const total = questionBank.questions.length;

  useEffect(() => {
    const stored = loadQuiz();
    if (stored) {
      const nextStep =
        stored.step >= total && firstOpenStep(stored.answers) < total ? firstOpenStep(stored.answers) : stored.step;
      setStep(nextStep);
      setAnswers(stored.answers);
    }
    setPartner(sanitizePartner(new URLSearchParams(window.location.search).get("partner")));
    setReady(true);
  }, [total]);

  useEffect(() => {
    if (!ready) return;
    saveQuiz({ version: 1, step, answers });
  }, [ready, step, answers]);

  useEffect(() => {
    if (!ready) return;
    headingRef.current?.focus();
    if (step < 0) document.title = `${BRAND.name} by ${BRAND.maker}`;
    else if (step >= total) document.title = `Your result · ${BRAND.name}`;
    else document.title = `Question ${step + 1} of ${total} · ${BRAND.name}`;
  }, [ready, step, total]);

  const result = useMemo(() => scoreAssessment(answers), [answers]);
  const question = step >= 0 && step < total ? questionBank.questions[step] : undefined;
  const answered = question ? isAnswered(question, answers) : false;
  const hasAnswers = Object.keys(answers).length > 0;

  function selectChoice(choiceId: string) {
    if (!question) return;
    setConfirmDelete(false);
    if (question.kind === "single") {
      setAnswers((current) => ({ ...current, [question.id]: choiceId }));
      return;
    }
    const existing = answers[question.id];
    const currentIds = Array.isArray(existing) ? existing : [];
    setAnswers((current) => ({ ...current, [question.id]: toggleMulti(question, currentIds, choiceId) }));
  }

  function reset() {
    clearQuiz();
    setAnswers({});
    setStep(-1);
    setConfirmDelete(false);
  }

  async function download() {
    setDownloading(true);
    try {
      const { downloadReport } = await import("../lib/pdf");
      await downloadReport(result, { partner, generatedAt: new Date() });
    } finally {
      setDownloading(false);
    }
  }

  const categories = [...result.categories].sort(
    (left, right) => right.score - left.score || left.title.localeCompare(right.title),
  );

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand">
            <Mark />
            <div>
              <p className="brand-name">{BRAND.name}</p>
              <p className="brand-by">
                by{" "}
                <a href={BRAND.makerUrl} rel="noreferrer">
                  {BRAND.maker}
                </a>
              </p>
            </div>
          </div>
          {partner ? <p className="partner">In partnership with {partner}.</p> : null}
        </div>
      </header>
      <main id="content" className="wrap">
        {!ready ? <p className="loading">Loading the assessment…</p> : null}

        {ready && step < 0 ? (
          <section className="panel">
            <p className="eyebrow">About 10 minutes · stays in this browser</p>
            <h1 ref={headingRef} tabIndex={-1}>
              See where AI tools are creating risk in your firm.
            </h1>
            <p className="lede">
              A free self-assessment for owners of small law firms, CPA firms, healthcare practices, and community
              banks. You will get a risk score, a short list of fixes, and a PDF you download here.
            </p>
            <div className="landing-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setStep(hasAnswers ? firstOpenStep(answers) : 0)}
              >
                {hasAnswers ? "Continue the assessment" : "Start the assessment"}
              </button>
              {hasAnswers ? (
                <button type="button" className="quiet" onClick={reset}>
                  Delete saved answers
                </button>
              ) : null}
            </div>
            <div className="split">
              <article>
                <h2>What you will answer</h2>
                <ul>
                  <li>Which AI tools staff use for work</li>
                  <li>What kinds of information go into them</li>
                  <li>Whether you have a policy, training, and firm accounts</li>
                </ul>
              </article>
              <article>
                <h2>What stays here</h2>
                <p>
                  Answers are kept in this tab&apos;s session storage so you can finish or refresh. They are not
                  uploaded. Close the tab, or choose delete, and they are gone.
                </p>
              </article>
            </div>
            <ul className="limits">
              {LIMITATIONS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {ready && question ? (
          <section className="panel">
            <p className="progress-label">
              {question.section} · Question {step + 1} of {total}
            </p>
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${((step + 1) / total) * 100}%` }} />
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (answered) setStep((current) => current + 1);
              }}
            >
              <h1 ref={headingRef} tabIndex={-1}>
                {question.prompt}
              </h1>
              {question.hint ? <p className="hint">{question.hint}</p> : null}
              {question.kind === "multi" ? <p className="hint">Select every answer that applies.</p> : null}
              <fieldset>
                <legend className="sr-only">{question.prompt}</legend>
                {question.choices.map((choice) => {
                  const value = answers[question.id];
                  const selected =
                    question.kind === "single" ? value === choice.id : Array.isArray(value) && value.includes(choice.id);
                  return (
                    <label key={choice.id} className={selected ? "choice selected" : "choice"}>
                      <input
                        type={question.kind === "single" ? "radio" : "checkbox"}
                        name={question.id}
                        value={choice.id}
                        checked={selected}
                        onChange={() => selectChoice(choice.id)}
                      />
                      <span>{choice.label}</span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="actions">
                <button type="button" className="quiet" onClick={() => setStep((current) => current - 1)}>
                  Back
                </button>
                <button type="submit" className="primary" disabled={!answered}>
                  {step === total - 1 ? "See my result" : "Next"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {ready && step >= total ? (
          <section className="panel">
            <p className="eyebrow">Self-assessment result</p>
            <h1 ref={headingRef} tabIndex={-1}>
              {result.bandTitle}
            </h1>
            <p className="score">
              <span>{result.overallScore}</span> out of 100
            </p>
            <p className="lede">{result.bandSummary}</p>
            <p className="hint">
              Based on {result.scoredAnswered} of {result.scoredTotal} scored questions. This helps reduce risk. It is
              not a legal opinion.
            </p>
            {result.profile.segmentLabel ? (
              <p className="meta-line">
                {result.profile.segmentLabel}
                {result.profile.staffSizeLabel ? ` · ${result.profile.staffSizeLabel} people` : ""}
                {result.profile.stateLabels.length > 0 ? ` · ${result.profile.stateLabels.join(", ")}` : ""}
              </p>
            ) : null}
            {result.profile.appalachianStates ? (
              <p className="callout">
                You noted Ohio, Kentucky, or West Virginia. The suggestions are written with small firms in those
                states in mind. Devices the firm does not manage are still outside what this checker can see.
              </p>
            ) : null}
            {result.hipaaNote ? <p className="callout">{result.hipaaNote}</p> : null}

            <h2>Risk by category</h2>
            <ol className="categories">
              {categories.map((category) => (
                <li key={category.id}>
                  <div className="cat-top">
                    <h3>{category.title}</h3>
                    <span className={`band band-${category.band}`}>
                      {category.bandTitle} · {category.score}
                    </span>
                  </div>
                  <p>{category.description}</p>
                  <div
                    className="meter"
                    role="img"
                    aria-label={`${category.title}: ${category.score} out of 100, ${category.bandTitle}`}
                  >
                    <span style={{ width: `${category.score}%` }} />
                  </div>
                </li>
              ))}
            </ol>

            <h2>Tools you reported</h2>
            <p>{result.tools.length > 0 ? result.tools.join(", ") : "No tools were selected."}</p>

            <h2>Prioritized fixes</h2>
            {result.fixes.length === 0 ? (
              <p>No fixes came out of these answers. Keep the tool list current when staff or products change.</p>
            ) : (
              <ol className="fixes">
                {result.fixes.map((fix) => (
                  <li key={fix.id}>
                    <span className={`priority priority-${fix.priority}`}>{PRIORITY_LABEL[fix.priority]}</span>
                    <h3>{fix.title}</h3>
                    <p>{fix.detail}</p>
                  </li>
                ))}
              </ol>
            )}

            <h2>What this does not cover</h2>
            <ul className="limits">
              {result.limitations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <aside className="cta">
              <h2>Next step</h2>
              <p>{result.cta.body}</p>
              <a className="primary" href={result.cta.href} rel="noreferrer">
                {result.cta.label}
              </a>
            </aside>

            <div className="actions">
              <button type="button" className="primary" onClick={() => void download()} disabled={downloading}>
                {downloading ? "Preparing PDF…" : "Download PDF report"}
              </button>
              <button type="button" className="quiet" onClick={() => setStep(0)}>
                Review questions
              </button>
              <button type="button" className="quiet" onClick={() => (confirmDelete ? reset() : setConfirmDelete(true))}>
                {confirmDelete ? "Click again to delete answers" : "Delete my answers"}
              </button>
            </div>

            <details className="answers">
              <summary>Your answers</summary>
              <dl>
                {result.answers.map((answer) => (
                  <div key={answer.questionId}>
                    <dt>{answer.prompt}</dt>
                    <dd>{answer.labels.length > 0 ? answer.labels.join("; ") : "Not answered"}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </section>
        ) : null}
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <p>
            {BRAND.name} by{" "}
            <a href={BRAND.makerUrl} rel="noreferrer">
              {BRAND.maker}
            </a>
            . Free and open source under the MIT license. The paid Vault product is at{" "}
            <a href={BRAND.makerUrl} rel="noreferrer">
              vaultsystems.ai
            </a>
            .
          </p>
        </div>
      </footer>
    </>
  );
}
