"use client";

import {
  BRAND,
  NOT_LEGAL_ADVICE,
  PROFILE_QUESTION_IDS,
  questionBank,
  questionsInFlow,
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

function pickerQuestion(id: string): Question {
  const question = questionBank.questions.find((item) => item.id === id);
  if (!question) throw new Error(`Missing ${id}`);
  return question;
}

export function QuizApp() {
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [partner, setPartner] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const flow = useMemo(() => questionsInFlow(answers), [answers]);
  const total = flow.length;
  const stateQuestion = pickerQuestion(PROFILE_QUESTION_IDS.states);
  const professionQuestion = pickerQuestion(PROFILE_QUESTION_IDS.segment);
  const stateAnswer = answers[stateQuestion.id];
  const professionAnswer = answers[professionQuestion.id];
  const picked =
    typeof stateAnswer === "string" &&
    stateQuestion.choices.some((choice) => choice.id === stateAnswer) &&
    typeof professionAnswer === "string" &&
    professionQuestion.choices.some((choice) => choice.id === professionAnswer);

  useEffect(() => {
    const stored = loadQuiz();
    if (stored) {
      const nextStep =
        stored.step >= questionsInFlow(stored.answers).length && firstOpenStep(stored.answers) < questionsInFlow(stored.answers).length
          ? firstOpenStep(stored.answers)
          : stored.step;
      setStep(nextStep);
      setAnswers(stored.answers);
    }
    setPartner(sanitizePartner(new URLSearchParams(window.location.search).get("partner")));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveQuiz({ version: 2, step, answers });
  }, [ready, step, answers]);

  useEffect(() => {
    if (!ready) return;
    headingRef.current?.focus();
    if (step < 0) document.title = `AI readiness check · ${BRAND.name}`;
    else if (step >= total) document.title = `Your result · ${BRAND.name}`;
    else document.title = `Question ${step + 1} of ${total} · ${BRAND.name}`;
  }, [ready, step, total]);

  const result = useMemo(() => scoreAssessment(answers), [answers]);
  const question = step >= 0 && step < total ? flow[step] : undefined;
  const answered = question ? isAnswered(question, answers) : false;
  const hasAnswers = Object.keys(answers).length > 0;

  function chooseProfile(questionId: string, choiceId: string) {
    setConfirmDelete(false);
    setAnswers((current) => {
      const next: Record<string, string | string[]> = { ...current, [questionId]: choiceId };
      const allowed = new Set(questionsInFlow(next).map((item) => item.id));
      for (const key of Object.keys(next)) {
        if (key === PROFILE_QUESTION_IDS.segment || key === PROFILE_QUESTION_IDS.states) continue;
        if (!allowed.has(key)) delete next[key];
      }
      return next;
    });
  }

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
        {!ready ? <p className="loading">Loading the readiness check…</p> : null}

        {ready && step < 0 ? (
          <section className="panel">
            <p className="eyebrow">AI readiness check · about 10 minutes · stays in this browser</p>
            <h1 ref={headingRef} tabIndex={-1}>
              Am I allowed to use AI, and will my staff actually use the approved tool?
            </h1>
            <p className="lede">
              A free check for small law firms, accounting and CPA firms, healthcare practices, and banks or credit
              unions. Pick a state and a profession. The questions, the score, and the PDF follow that choice.
            </p>
            <p className="callout">{NOT_LEGAL_ADVICE}</p>
            <fieldset className="picker">
              <legend>{stateQuestion.prompt}</legend>
              {stateQuestion.hint ? <p className="hint">{stateQuestion.hint}</p> : null}
              <div className="picker-options">
                {stateQuestion.choices.map((choice) => {
                  const selected = stateAnswer === choice.id;
                  return (
                    <label key={choice.id} className={selected ? "choice selected" : "choice"}>
                      <input
                        type="radio"
                        name={stateQuestion.id}
                        value={choice.id}
                        checked={selected}
                        onChange={() => chooseProfile(stateQuestion.id, choice.id)}
                      />
                      <span>{choice.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="picker">
              <legend>{professionQuestion.prompt}</legend>
              {professionQuestion.hint ? <p className="hint">{professionQuestion.hint}</p> : null}
              <div className="picker-options">
                {professionQuestion.choices.map((choice) => {
                  const selected = professionAnswer === choice.id;
                  return (
                    <label key={choice.id} className={selected ? "choice selected" : "choice"}>
                      <input
                        type="radio"
                        name={professionQuestion.id}
                        value={choice.id}
                        checked={selected}
                        onChange={() => chooseProfile(professionQuestion.id, choice.id)}
                      />
                      <span>{choice.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="landing-actions">
              <button
                type="button"
                className="primary"
                disabled={!picked}
                onClick={() => setStep(hasAnswers ? firstOpenStep(answers) : 0)}
              >
                {hasAnswers && picked ? "Continue the readiness check" : "Start the readiness check"}
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
                  <li>Whether you have a policy, consent, training, and an approved-tool list</li>
                  <li>Whether the approved tool is good enough that staff stay on it</li>
                  <li>For law firms, whether a person checks citations before filing or sending</li>
                </ul>
              </article>
              <article>
                <h2>What stays here</h2>
                <p>
                  Answers stay in this browser. They are not uploaded. The browser extension and the DNS check are
                  supporting tools for managed devices and the office resolver. They are not this check, and they do
                  not see unmanaged or personal devices.
                </p>
              </article>
            </div>
            <ul className="limits">
              {result.limitations.map((line) => (
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
            <p className="eyebrow">AI readiness result</p>
            <h1 ref={headingRef} tabIndex={-1}>
              {result.bandTitle}
            </h1>
            <p className="score">
              <span>{result.overallScore}</span> out of 100
            </p>
            <p className="lede">{result.bandSummary}</p>
            <p className="hint">
              Based on {result.scoredAnswered} of {result.scoredTotal} scored questions for this state and profession.
              This helps reduce risk. It is not legal advice.
            </p>
            {result.profile.segmentLabel ? (
              <p className="meta-line">
                {result.profile.segmentLabel}
                {result.profile.staffSizeLabel ? ` · ${result.profile.staffSizeLabel} people` : ""}
                {result.profile.stateLabels.length > 0 ? ` · ${result.profile.stateLabels.join(", ")}` : ""}
              </p>
            ) : null}
            <p className="callout">{result.rules.notLegalAdvice}</p>
            {result.hipaaNote ? <p className="callout">{result.hipaaNote}</p> : null}

            <h2>What your rules expect</h2>
            {result.rules.expectations.length === 0 ? (
              <p>Pick a state and a profession to see the sources this check can cite. No rule is encoded until you do.</p>
            ) : (
              <ol className="rules">
                {result.rules.expectations.map((item) => (
                  <li key={item.id}>
                    <p>{item.summary}</p>
                    <p className="hint">
                      <a href={item.url} rel="noreferrer">
                        {item.citation}
                      </a>
                    </p>
                  </li>
                ))}
              </ol>
            )}
            {result.rules.notes.map((note) => (
              <p key={note.id} className="callout">
                {note.summary}
              </p>
            ))}

            <h2>Gaps</h2>
            {result.rules.gaps.length === 0 ? (
              <p>No cited expectation is out of line with the answers so far. Missing answers are not treated as gaps.</p>
            ) : (
              <ol className="rules">
                {result.rules.gaps.map((gap) => (
                  <li key={gap.id}>
                    <p>{gap.detail}</p>
                    <p>{gap.summary}</p>
                    <p className="hint">
                      <a href={gap.url} rel="noreferrer">
                        {gap.citation}
                      </a>
                    </p>
                  </li>
                ))}
              </ol>
            )}

            <h2>Where the score comes from</h2>
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

            {result.rules.example ? (
              <>
                <h2>Why staff go around an approved tool</h2>
                <p>{result.rules.example.intro}</p>
                <p>{result.rules.example.summary}</p>
                <p className="hint">
                  <a href={result.rules.example.url} rel="noreferrer">
                    {result.rules.example.citation}
                  </a>
                </p>
                <p>{result.rules.example.newsSummary}</p>
                <p className="hint">
                  <a href={result.rules.example.newsUrl} rel="noreferrer">
                    {result.rules.example.newsCitation}
                  </a>
                </p>
              </>
            ) : null}

            <h2>Tools you reported</h2>
            <p>{result.tools.length > 0 ? result.tools.join(", ") : "No tools were selected."}</p>

            <h2>Prioritized fixes</h2>
            {result.fixes.length === 0 ? (
              <p>No fixes came out of these answers. Keep the approved-tool list current when staff or products change.</p>
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
            . Free and open source under the MIT license. This check is not legal advice. The paid Vault product is at{" "}
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
