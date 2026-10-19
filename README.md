# Shadow AI Checker

**by [Vault Systems](https://vaultsystems.ai)**

Shadow AI Checker is a free, open-source **AI readiness check** for small regulated businesses. It answers two questions: am I allowed to use AI, and will my staff actually use the approved tool?

It is written for law firms, accounting and CPA firms, small healthcare practices, and banks or credit unions, starting with Ohio, Kentucky, and West Virginia. You pick a state and a profession first. The questions, the score weights, and the PDF follow that choice. Rules live in data (`packages/core/src/data/jurisdictions.json`) so another state can be added without rewriting the quiz.

This check is not legal advice and not an ethics opinion. It helps reduce risk. It does not decide whether a firm has met HIPAA, ethics rules, or any other duty, and it does not see devices the firm does not manage.

The browser extension and the DNS check are supporting tools for managed devices and the office resolver. They are not the headline.

The paid [Vault](https://vaultsystems.ai) product is for firms that want help putting the fixes into practice. The report ends with a link to get a free AI Readiness Check from Vault.

## What is in the box

| Piece | What it does |
| --- | --- |
| [`packages/core`](packages/core) | Question bank, jurisdiction rules, scoring, AI-service domains, and sensitive-data patterns. Framework-agnostic, so it can move into Vault's private monorepo as `packages/shadow-ai`. |
| [`apps/quiz`](apps/quiz) | The readiness check. About 10 minutes, entirely in the browser, with a PDF. Intended for [checker.vaultsystems.ai](https://checker.vaultsystems.ai). |
| [`apps/extension`](apps/extension) | Supporting tool. Manifest V3 extension for Chrome and Edge (Firefox 115+ can load the same build). Warns on the device when a paste into a known AI site matches a sensitive pattern. |
| [`apps/dns-check`](apps/dns-check) | Supporting tool for IT providers. Reads Pi-hole, dnsmasq, BIND, or CSV query logs and writes a CSV and Markdown report, plus a Pi-hole blocklist and allowlist of the catalog. |

## Privacy model

- **Quiz.** Answers stay in the browser. They are written to this tab's session storage so a refresh does not wipe the page, and they are cleared when the tab closes or when the user deletes them. There is no account, no backend, and no upload.
- **Extension.** Paste text is checked in memory and then dropped. The extension stores anonymous counts only: visits by product name, and warnings by pattern type (SSN, card, email, phone, health hint, client-matter hint). It does not store page contents, prompts, or the pasted text. This version does not make a network call. `apps/extension/src/report-counts.ts` is a stub for a future opt-in dashboard and it does not send anything.
- **DNS check.** It reads a log file you point it at and writes a report next to you. It does not phone home. Client addresses in the report are whatever the log already contained.

An MSP can add `?partner=North%20River%20MSP` to the quiz URL. The name is shown as co-branding and printed on the PDF. It is length-limited and stripped of markup. It is not sent to a server by this project.

## What this does not cover

Unmanaged and personal devices are out of scope. A home laptop, a personal phone on a cellular network, and any browser without the extension will not show up. DNS visibility stops at the resolver you scan: DNS-over-HTTPS that bypasses Pi-hole, and queries from devices that do not use it, are invisible. A quiet report is not proof that sensitive information stayed inside the firm.

Domain lists and pattern matches are incomplete on purpose. Broad company domains such as `google.com` and `microsoft.com` are left out so a blocklist does not knock out ordinary work. Copilot inside desktop Office can be one of those gaps. Meeting bots and document-upload sites are only covered when their own hostnames are in the catalog.

Some states, including New York, Connecticut, and Delaware, require notice before an employer monitors electronic activity. If you install the extension on managed browsers, start from [the employee notice template](apps/extension/EMPLOYEE_NOTICE.md) and the [admin deployment note](apps/extension/ADMIN_DEPLOYMENT.md), and have counsel review them. The templates are not legal advice.

## Quickstart

Requires Node.js 22+ and pnpm 10.

```bash
pnpm install
pnpm test
pnpm build
```

### Quiz

```bash
pnpm dev
```

Open the printed localhost URL. Pick a state and a profession, answer the questions, then download the PDF or follow the Vault link. A static export is produced by:

```bash
pnpm --filter @shadow-ai/quiz build
```

Upload `apps/quiz/out` to any static host. No server and no environment variables. For a co-branded link, use `https://checker.vaultsystems.ai/?partner=Your%20MSP`.

### Browser extension

```bash
pnpm --filter @shadow-ai/extension build
```

In Chrome or Edge, open the extensions page, turn on Developer mode, and load `apps/extension/dist`. Firefox 115+ can load that folder as a temporary add-on from `about:debugging`. Visit a catalog site such as ChatGPT, open the toolbar popup to see the visit count, and paste a fake SSN (`219-09-9999`) to see the on-device warning. The warning does not repeat the pasted text.

Deployment for managed browsers, including the notice you should give staff, is in [apps/extension/ADMIN_DEPLOYMENT.md](apps/extension/ADMIN_DEPLOYMENT.md).

### DNS check

```bash
pnpm --filter @shadow-ai/dns-check exec shadow-ai-dns --help
pnpm --filter @shadow-ai/dns-check exec shadow-ai-dns scan \
  --input apps/dns-check/examples/dnsmasq.log \
  --format pihole \
  --out ./tmp-report
pnpm --filter @shadow-ai/dns-check exec shadow-ai-dns export-lists --out ./tmp-report
```

`scan` accepts:

| `--format` | Input |
| --- | --- |
| `auto` | Sniff CSV, dnsmasq/Pi-hole text, BIND, or a Pi-hole FTL SQLite file |
| `pihole`, `dnsmasq` | `query[A] name from client` lines, including `/var/log/pihole/pihole.log` |
| `bind` | BIND query logs (`query: name IN A`) |
| `csv` | Header row with a domain column (`domain`, `query`, `qname`, `name`, or `host`) |
| `pihole-db` | Pi-hole FTL `queries` table with `domain`, `timestamp`, and `client` |

The text report is `shadow-ai-dns-report.md` plus `shadow-ai-dns-report.csv`. `export-lists` writes `shadow-ai-blocklist.txt` and `shadow-ai-allowlist.txt` for Pi-hole. Review the list before blocking anything. Low-signal names such as Notion are the whole product, not only its AI feature. The allowlist is the same catalog for domains you have decided to permit. It is not a recommendation to allow all of them.

If your Pi-hole version stores client addresses in a different table, export a CSV from the query log and use `--format csv`.

## Sources the report cites

The report only states requirements that were checked against a primary source, or it says plainly that this checklist does not encode a rule. Citations are in the PDF and on the results page.

| Topic | What the check says | Source |
| --- | --- | --- |
| Kentucky law firms | KBA E-457 (Mar. 15, 2024) answers yes to policies and training for supervisors, continued confidentiality, and review of generative-AI submissions for accuracy and against court rules. It answers no to a general duty to disclose ordinary AI research. | [KBA E-457](https://kybar.org/Portals/0/Admin/Ethics%20Opinions/KBA%20E-457.pdf) |
| West Virginia law firms | L.E.O. 2024-01 is listed by the Lawyer Disciplinary Board, whose index says legal ethics opinions are advisory and not binding on the Supreme Court of Appeals. The Office of Disciplinary Counsel's 2024 slides, describing that opinion, say a lawyer should get informed client approval, confirmed in writing, before using generative AI. | [Opinion index](https://wvodc.org/Legal-Ethics-Opinion), [ODC slides](https://wvbar.org/wp-content/uploads/2024/08/ODC-Presentation-1.pdf) |
| Ohio law firms | The 2026 Ohio Ethics Guide is nonbinding staff guidance. It says the rules do not prohibit AI and that competent use includes human review of facts and citations. It does not, by itself, require a written firm AI policy. | [Ohio Ethics Guide](https://www.bpc.ohio.gov/_files/ugd/c6a571_4e12e5f9a0104eaebe9351007c899b4f.pdf) |
| Law firms, any state in this check | ABA Formal Opinion 512 (July 29, 2024) is model guidance, not the state rule. | [Formal Opinion 512](https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf) |
| Sanctions, in general | The report says unchecked citations can lead to sanctions. KBA E-457 cites Mata v. Avianca, 2023 WL 4114965 (S.D.N.Y. June 22, 2023). The Ohio guide notes sanctions in other jurisdictions. The check does not predict a sanction. | Those two sources |
| Accounting / CPA | IRC §7216 and Treas. Reg. §301.7216-3 address disclosure of tax-return information and written consent. Circular 230 §§10.22 and 10.35 are diligence and competence. IRS OPR Issue 2026-19 applies those duties to generative AI. Circular 230 has no separate AI section. | [§7216](https://www.law.cornell.edu/uscode/text/26/7216), [§301.7216-3](https://www.law.cornell.edu/cfr/text/26/301.7216-3), [OPR 2026-19](https://www.irs.gov/pub/opr-taxpros/issue-number-2026-19-introductory-guidelines-for-responsible-ai-use-in-federal-tax-practice.pdf) |
| Banks | One example, not a rule: CB Financial Services, Inc. Form 8-K (May 2026) describes an unauthorized AI application and non-public customer information. A later American Banker report, not the 8-K, says an approved tool existed and a personal account was used. | [Form 8-K](https://www.sec.gov/Archives/edgar/data/1605301/000160530126000021/cbfv-20260507.htm), [American Banker](https://www.americanbanker.com/news/a-bank-breaks-its-silence-on-its-shadow-ai-breach) |

### What is not in the rules file

- A court opinion about a Kentucky lawyer, CoCounsel, and the Sixth Circuit. That story was not verified here, so it is not cited.
- The full text of West Virginia L.E.O. 2024-01 as a standalone opinion PDF. Consent language is taken from the Office of Disciplinary Counsel slides that describe the opinion, and the opinion's advisory status is taken from the Board's index.
- Any claim that the 8-K itself says an approved tool already existed. That sentence is attributed to the American Banker report.
- A state medical-board AI opinion, a state board of accountancy AI opinion, or a banking-agency AI regulation. The check says those are not encoded.
- An IRS ruling that names a particular AI product under §7216.
- Any statement that SOC 2 is legally irrelevant. The question asks whether someone read the training terms or data-processing agreement, which is a different document from a security report.

## Roadmap

- An opt-in way for a firm to send anonymous counts to a dashboard. The hook is stubbed and does not open a connection today.
- A store listing and extension id so managed Chrome and Edge policies can force-install a published build.
- More Pi-hole FTL schemas, if client addresses move out of the `queries` table.
- Tighter local-only patterns, still without keeping the text that matched.
- Question-bank and jurisdiction edits as firms tell us which questions are actually useful, and as more states get a verified source.
- Lifting `packages/core` into Vault's private monorepo as `packages/shadow-ai` without taking the quiz, extension, or CLI along unless we want them.

## License

[MIT](LICENSE) © Vault Systems.

[Contribute](CONTRIBUTING.md) a domain, a pattern, or a clearer question. Please keep the wording honest.
