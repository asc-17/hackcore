# Antigravity — Build Spec (AI-Based Predictive Personnel Stress & Welfare Monitoring System)

## Role & Goal
Build an Android (Kotlin) app + backend AI pipeline that predicts personnel welfare risk from HR/duty data and self-reported wellness data, explains it in plain language, and routes it to the right role — without exposing individual psychological data to disciplinary authority.

## Users & Visibility Rules
- **Personnel**: daily wellness check-in (mood, sleep, workload — ~15 sec, tap-based). Optional Google Health Connect sync (sleep, HR, steps, activity). Sees: own trend + own recommendations only.
- **Commander**: enters existing HR/duty data once per event (duty hours, shift, consecutive duty days, leave, deployment, transfers, training load). Sees: unit-level risk-tier distribution + top organizational drivers only. **Never** sees individual scores or free text.
- **Wellness Officer**: sees aggregate view + full individual-level detail. Sole recipient of risk alerts and crisis escalations.

## Core Pipeline (strict order, do not merge stages)
1. **Data collection** — Commander HR data (event-based) + Personnel check-in (daily) + optional Health Connect (passive).
2. **Feature engineering** — rolling averages + trend slopes (7/14/28-day), each expressed as **deviation from the individual's own historical baseline** (never population norm).
3. **Risk Engine (prediction only)** — weighted rules model (build first, non-negotiable) + optional Random Forest/XGBoost model (stretch). Output: 0–100 score, tier (Stable/Moderate/Elevated/Priority), trend direction, ranked contributing factors, confidence/data-completeness flag.
4. **Claude Haiku (explanation only, server-side)** — input = structured Risk Engine output ONLY (never raw personal data), self-reported vs HR-derived sub-signals kept separate (not pre-merged), + last 4–6 cycles of scores. System prompt must: forbid diagnostic/medical claims, require supportive non-disciplinary tone, force JSON-only output, require every claim traceable to given data. Output: plain-language summary, prioritized recommendations, urgency level, signal-alignment verdict (`CONSISTENT` / `MIXED` / `CONFLICTING`). Call Claude only (a) when a person's Risk Engine result changes, or (b) once/day per unit for the aggregate digest — never on screen load. Store output; screens read from storage.
5. **Role-based presentation** — per visibility rules above.
6. **Crisis escalation (parallel, independent path)** — acute distress self-report bypasses stages 3–4 entirely → immediate alert to Wellness Officer + in-app crisis info to Personnel. Must never depend on an AI call succeeding.

## Hard Constraints
- Risk **prediction** happens only in the Risk Engine — never let the LLM infer/assign a risk score.
- Baseline-relative scoring only, not population-relative.
- No individual wellness data to Commanders, ever — structural (server-side RBAC), not UI-hidden.acc
- No API keys or DB credentials on client — backend (FastAPI) mediates all AI/DB calls.
- No clinical/diagnostic inputs (e.g. symptom checklists) in the Risk Engine.
- No LLM fine-tuning — prompting/structured JSON output only.
- No multi-turn memory for open Q&A — each query is single-turn, scoped to aggregate data.
- Crisis path is architecturally separate from and never gated by the routine scoring/AI pipeline.

## Tech Stack
| Layer | Tech |
|---|---|
| Mobile | Android, Kotlin (for direct Health Connect access) |
| Backend | Python, FastAPI |
| DB | PostgreSQL (Neon) |
| Risk Engine | Python — pandas, scikit-learn, XGBoost |
| Explanation | Claude Haiku via Anthropic API, server-side only |
| Health data | Google Health Connect API (optional, consent-based) |
| Hardware | Standard Android devices, no custom hardware |

## Build Order
1. Shared data contract (features in → structured risk result out).
2. Weighted Risk Engine (fully explainable, demoable alone).
3. Validate against hand-built scenarios: stable / gradually elevated / acute-high-risk / new-personnel-low-data.
4. Android check-in flow + Commander HR entry + role-based dashboards, built against Risk Engine contract.
5. Integrate Claude Haiku, prompt-constrained to structured output only.
6. Build synthetic domain-specific dataset (military/paramilitary duty patterns) → train RF/XGBoost as upgrade layer.
7. Integrate Health Connect (optional enhancement).
8. Polish dashboards, rehearse escalation-path demo.

## Key Differentiators (must preserve in any pitch/demo)
- Prediction/explanation separation survives "what was this trained on" scrutiny.
- Baseline-relative scoring cuts false positives for high-demand roles.
- Same numeric score → different recommendations depending on which factors dominate.
- Signal-alignment badge (`CONFLICTING` cases flagged for human review regardless of tier).
- Daily digest auto-answers 2–3 fixed high-value questions as populated cards on load, + one open-ended query box scoped to aggregate data — no separate pipeline needed for either.
- Domain-specific synthetic training data (not repurposed student/clinical datasets) — must be framed honestly, not overclaimed.
- Purpose-built for CAPF/Armed Forces operational rhythms (deployment length, consecutive duty days, night shifts, transfer frequency), not generic corporate wellness.

## Known Risks → Mitigations (compressed)
| Risk | Mitigation |
|---|---|
| Privacy erosion | Server-side RBAC, AI-layer data minimization, audit logging |
| Stigmatization → dishonest input | Commanders never see individual data; "Welfare Risk Indicator" framing, never "diagnosis" |
| False positive/negative alerts | Baseline-relative scoring, confidence flagging, monitor recall on high-risk tiers |
| Black-box AI distrust | Two-layer architecture: inspectable Risk Engine + bounded-role LLM |
| Data breach | No client-side secrets; Health Connect opt-in only |
| Low adoption | Make "welfare not discipline" design visible in-app, not just backend policy |
| Dataset domain mismatch | Public datasets = methodology reference only; train on domain-specific synthetic data |
| Scope creep to clinical diagnosis | Exclude symptom checklists from Risk Engine; route acute disclosures to crisis path only |

## Feasibility Notes
- MVP is high-feasibility: all mature, off-the-shelf tech; innovation is architectural composition, not new ML research.
- Rules-engine baseline demoable within 1–2 days; no training-data wait required.
- If time runs short, system fully demos on rules engine alone (ML model is a stretch, not a dependency).
- Deferred features (by design, not oversight): LLM fine-tuning, full case-management workflow, multi-turn Q&A memory, heavyweight auth, upfront full schema design.
- Production path (post-prototype): HRMS integration, formal consent/governance, validation on real governed data, command + personnel buy-in.

## Impact / Value Summary
- Personnel: earlier, low-friction, private signal surfacing.
- Commanders: actionable systemic (not individual) welfare data.
- Wellness Officers: prioritized, evidence-based caseload with full human judgment retained.
- Org: shifts welfare posture from reactive to preventive; framework generalizes to CAPFs, Armed Forces, State Police, disaster response, and long-term corporate high-stress use cases.

## One-Line Pitch
*Separates prediction (explainable Risk Engine) from explanation (Claude Haiku), separates visibility by role (structural, not cosmetic), and separates routine monitoring from crisis response — a defensible, welfare-not-discipline architecture, not just a demo.*
