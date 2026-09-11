# AI-Based Personnel Stress & Welfare Monitoring System
## Master Step-by-Step Task Breakdown & Execution Plan

> **Source Specification**: [`overview.md`](overview.md)  
> **Target System**: Android (Kotlin) + FastAPI (Python) + PostgreSQL + Deterministic Risk Engine + Claude Haiku (Explanation)

---

## Progress Overview

- [ ] **Phase 1: Shared Data Contract & Architecture Specifications**
- [ ] **Phase 2: Weighted Deterministic Risk Engine & Test Scenarios**
- [ ] **Phase 3: Backend API (FastAPI) & Database (PostgreSQL)**
- [ ] **Phase 4: Claude Haiku Structured Explanation Layer**
- [ ] **Phase 5: Parallel Crisis Escalation Path (Zero-AI Path)**
- [ ] **Phase 6: Android Client Core — Daily Check-in & Offline Sync**
- [ ] **Phase 7: Role-Based Mobile/Web Dashboards & Commander Entry**
- [ ] **Phase 8: Synthetic Dataset Generation & ML Model Upgrade**
- [ ] **Phase 9: Google Health Connect Passive Ingestion (Consent-Based)**
- [ ] **Phase 10: End-to-End Hardening, Security Audits & Demo Rehearsal**

---

## Phase 1: Shared Data Contract & Architecture Specifications

**Goal**: Define immutable schemas, data types, and interfaces shared between Android, FastAPI backend, Risk Engine, and LLM explanation layer.

- [ ] **Task 1.1: Define Core Event Schemas (Pydantic / Kotlin data classes)**
  - `PersonnelCheckInEvent`: timestamp, user_id, mood (1-5), sleep_quality (1-5), perceived_workload (1-5), energy_level (1-5), acute_distress_flag (boolean).
  - `CommanderDutyEvent`: timestamp, event_id, personnel_id, unit_id, shift_type (Day/Night/Split), duty_hours, consecutive_duty_days, leave_status, deployment_type, transfer_history_count.
  - `HealthConnectMetrics` (optional): resting_hr, sleep_duration_minutes, sleep_deep_percentage, step_count, hrv_rmssd.
- [ ] **Task 1.2: Define Risk Engine Output Contract**
  - `RiskEngineResult`:
    - `personnel_id`: UUID/String
    - `timestamp`: ISO-8601
    - `score`: float (0.0 to 100.0)
    - `tier`: Enum (`STABLE`, `MODERATE`, `ELEVATED`, `PRIORITY`)
    - `trend_direction`: Enum (`IMPROVING`, `STABLE`, `DETERIORATING`)
    - `signal_alignment`: Enum (`CONSISTENT`, `MIXED`, `CONFLICTING`)
    - `ranked_factors`: List of `{ factor_name: str, contribution_weight: float, baseline_delta: float }`
    - `confidence_flag`: Enum (`HIGH`, `MODERATE`, `LOW_DATA_COLD_START`)
    - `data_completeness`: float (0.0 to 1.0)
- [ ] **Task 1.3: Define Claude Haiku Explanation Contract (Strict JSON Only)**
  - `ExplanationPayload`:
    - `summary`: string (plain-language, supportive, non-clinical)
    - `primary_driver`: string
    - `recommended_actions`: list of strings (actionable, organizational/wellness)
    - `urgency_level`: Enum (`ROUTINE`, `ATTENTION_NEEDED`, `URGENT_TRIAGE`)
    - `signal_alignment_verdict`: `CONSISTENT` | `MIXED` | `CONFLICTING`
    - `audit_traces`: list of mappings tying claims back to specific factors
- [ ] **Task 1.4: Define Role-Based Visibility & Authorization Matrix**
  - Explicit API permissions:
    - `ROLE_PERSONNEL`: Read own check-ins, own score trend, own recommendations. Cannot view other personnel or unit aggregates.
    - `ROLE_COMMANDER`: Post duty events, read unit risk tier distribution and top unit drivers. Hard query-level constraint: **zero access** to individual scores or free text.
    - `ROLE_WELLNESS_OFFICER`: Full read access to individual and aggregate scores, triage queue, and crisis alerts.

---

## Phase 2: Weighted Deterministic Risk Engine & Test Scenarios

**Goal**: Build an inspectable, deterministic, zero-AI rules engine that operates purely on baseline-relative deviations.

- [ ] **Task 2.1: Feature Engineering Pipeline (Rolling Deviations)**
  - Implement rolling window calculators (7-day, 14-day, 28-day):
    - Individual historical mean ($\mu_{base}$) and standard deviation ($\sigma_{base}$) for each metric.
    - Standardized individual deviation: $Z_i = \frac{x_{current} - \mu_{base}}{\sigma_{base} + \epsilon}$.
    - Slope calculations (trend direction over 7 and 14 days).
  - Add cold-start handler for days 1–6 (fallback to default variance with `LOW_DATA_COLD_START` flag).
- [ ] **Task 2.2: Weighted Rules Scoring Algorithm**
  - Formulate weighted composite scoring function:
    - Workload/Duty Burden (consecutive days, night shifts, duty hours spike).
    - Recovery Deficit (sleep duration/quality drop below individual baseline).
    - Subjective Strain (mood and energy trend deviations).
  - Map final weighted score to tiers:
    - 0–29: `STABLE`
    - 30–54: `MODERATE`
    - 55–79: `ELEVATED`
    - 80–100: `PRIORITY`
  - Compute `signal_alignment`: Flag `CONFLICTING` if self-reported strain is low but objective duty load deviation is $> 2.0\sigma$ (or vice versa).
- [ ] **Task 2.3: Verification Suite (Hand-Crafted Scenarios)**
  - **Scenario A (Stable Baseline)**: High consistent workload with consistent recovery -> Score remains `STABLE`.
  - **Scenario B (Gradual Elevation)**: 12 consecutive days on duty + gradual sleep drop -> Escalates from `STABLE` to `ELEVATED`.
  - **Scenario C (Acute High-Risk)**: Sudden double shifts + sharp drop in mood -> Triggers `PRIORITY` with high confidence.
  - **Scenario D (Cold-Start / New Personnel)**: Days 1–3 data only -> Outputs score with `LOW_DATA_COLD_START` flag.
  - **Scenario E (Masked Distress / Conflicting)**: Excellent self-reported mood despite 18 consecutive night shifts -> Flags `CONFLICTING`.

---

## Phase 3: Backend API (FastAPI) & Database (PostgreSQL)

**Goal**: Set up FastAPI service, PostgreSQL models with server-side RBAC, and risk calculation triggers.

- [ ] **Task 3.1: Database Schema & Migrations (Alembic / SQLModel)**
  - Tables: `users`, `roles`, `units`, `check_ins`, `duty_events`, `health_metrics`, `risk_evaluations`, `explanations`, `crisis_alerts`, `audit_logs`.
  - Enforce foreign keys, unique indices on `(user_id, date)`, and audit logging timestamps.
- [ ] **Task 3.2: Authentication & Server-Side RBAC Middleware**
  - JWT-based authentication with role claims.
  - Strict endpoint dependency checks (`require_role("COMMANDER")`, `require_role("WELLNESS_OFFICER")`).
  - Unit data isolation: Commanders can only query units under their hierarchy.
- [ ] **Task 3.3: Ingestion Endpoints**
  - `POST /api/v1/personnel/check-in`: Ingests daily check-in; returns confirmation and crisis check status.
  - `POST /api/v1/commander/duty-events`: Bulk or single entry of duty/shift events.
  - `POST /api/v1/personnel/health-sync`: Ingests passive Health Connect aggregates.
- [ ] **Task 3.4: Risk Evaluation Trigger & Caching Layer**
  - Evaluate risk on check-in or duty event update (asynchronous Celery/FastAPI background task).
  - Persist output to `risk_evaluations`.
  - Cache current state to prevent redundant recalculations.
- [ ] **Task 3.5: Read Endpoints (Enforcing Strict Visibility Rules)**
  - `GET /api/v1/personnel/me/welfare`: Returns caller's own score, trend, and explanation.
  - `GET /api/v1/commander/unit/{unit_id}/summary`: Aggregates risk tiers (e.g. `{ stable: 60%, moderate: 25%, elevated: 10%, priority: 5% }`) and top 3 unit-level drivers. **Zero individual identifiers.**
  - `GET /api/v1/wellness-officer/triage`: Ranked list of personnel by risk tier and signal alignment for officer review.

---

## Phase 4: Claude Haiku Structured Explanation Layer

**Goal**: Integrate Claude Haiku server-side to generate plain-language, non-clinical explanations from structured risk results.

- [ ] **Task 4.1: Prompt Engineering & Guardrails Specification**
  - System prompt constraints:
    - *Forbid* diagnostic, psychiatric, or medical terminology (e.g., no "depression", "insomnia disorder", "pathology").
    - *Enforce* supportive, non-punitive, organizational-welfare tone.
    - *Constrain* output to exact JSON schema matching `ExplanationPayload`.
    - *Require* every recommendation to cite a specific factor from the Risk Engine output.
- [ ] **Task 4.2: Anthropic API Client & Schema Validation**
  - Implement async client with retry, timeout, and fallback handling.
  - Parse response with Pydantic; if schema validation fails, fallback to template-based rules explanation.
- [ ] **Task 4.3: Invocation Throttling & Storage**
  - Trigger explanation generation *only* when:
    1. A personnel's risk tier changes (`STABLE` -> `MODERATE`, etc.).
    2. A once-per-day scheduled digest runs.
  - Never invoke LLM on client screen load; client reads cached explanation from database.
- [ ] **Task 4.4: Commander Unit Digest Generator**
  - Auto-generate aggregate summary answering 2–3 fixed high-value questions:
    - "What is driving elevated risk across the unit this week?"
    - "Which operational factors (shifts, consecutive duty) have the steepest upward trend?"
  - Provide single-turn Q&A endpoint scoped strictly to unit-level aggregate metrics.

---

## Phase 5: Parallel Crisis Escalation Path (Zero-AI Path)

**Goal**: Implement an immediate, standalone intervention pathway for acute distress reports that operates independently of the AI and scoring pipeline.

- [ ] **Task 5.1: Acute Distress Detection & Routing**
  - Dedicated trigger on check-in: explicit toggle or distress confirmation.
  - Bypasses feature engineering, Risk Engine, and Claude Haiku completely.
- [ ] **Task 5.2: Immediate Personnel In-App Response**
  - Returns immediate local/cached crisis hotline numbers, unit chaplain/welfare officer direct contacts, and confidential assistance instructions.
- [ ] **Task 5.3: Wellness Officer Priority Alert Dispatch**
  - Creates high-priority entry in `crisis_alerts` table.
  - Triggers push notification / SMS / internal alert channel to assigned Wellness Officer.
  - Audit log entry created without detailing sensitive psychological disclosures.

---

## Phase 6: Android Client Core — Daily Check-in & Offline Sync

**Goal**: Build a frictionless, 15-second tap-based Android app with offline resilience.

- [ ] **Task 6.1: Project Setup & Architecture (Kotlin, Jetpack Compose)**
  - Clean Architecture (Data, Domain, Presentation), Hilt DI, Retrofit/OkHttp, Room database.
- [ ] **Task 6.2: Personnel 15-Second Daily Check-In UI**
  - Modern, high-aesthetic Jetpack Compose interface with haptic feedback.
  - 4 quick tap-based sliders/chips: Mood, Sleep, Workload, Energy.
  - Clear, distinct "Request Immediate Support" (Crisis) action button.
- [ ] **Task 6.3: Local Room Persistence & Offline Sync Worker**
  - Store check-in locally in Room DB immediately upon submission.
  - Use Android `WorkManager` for exponential backoff network synchronization during low connectivity.
- [ ] **Task 6.4: Personnel Welfare Dashboard**
  - Display personal welfare trend (7/14/28-day visual curve).
  - Display Claude Haiku supportive summary and recommendations card.
  - Explicit privacy guarantee banner: *"Your individual wellness data is never visible to your Commander."*

---

## Phase 7: Role-Based Mobile/Web Dashboards & Commander Entry

**Goal**: Build role-specific interfaces upholding strict data visibility rules.

- [ ] **Task 7.1: Commander HR & Duty Event Entry Interface**
  - Quick-entry forms for shift assignments, duty hours, night patrol logs, leave cancellations, and deployment status.
  - Batch entry / CSV import option for entire squads/units.
- [ ] **Task 7.2: Commander Aggregate Dashboard**
  - Risk tier distribution chart (donut/bar chart of unit percentages).
  - Top 3 systemic drivers card (e.g., "Night shifts without 24h rest").
  - Automated daily digest card + single-turn aggregate inquiry box.
  - **Verification**: Ensure inspect network payloads confirm no personnel names or individual records are transferred.
- [ ] **Task 7.3: Wellness Officer Triage Console**
  - Prioritized list sorted by:
    1. Active Crisis Alerts
    2. `PRIORITY` / `ELEVATED` risk tiers
    3. `CONFLICTING` signal alignment badges
  - Drill-down modal showing factor breakdown (duty load vs. self-reported trends) and explanation trace.
  - Action log: record contact initiated, leave recommended, or support provided.

---

## Phase 8: Synthetic Dataset Generation & ML Model Upgrade

**Goal**: Create a domain-accurate synthetic operational dataset and train a Random Forest / XGBoost model as an upgrade layer.

- [ ] **Task 8.1: Synthetic Operational Dataset Generator Script**
  - Model realistic military/paramilitary duty patterns:
    - 24-hour shifts, border patrol rotations, high-tempo training phases, sleep disruption curves.
    - Realistic noise, missing check-in days, and reporting variations.
    - 5,000+ simulated personnel over 90-day operational cycles.
- [ ] **Task 8.2: ML Model Training & Validation (scikit-learn / XGBoost)**
  - Train classifier/regressor against engineered baseline-relative features.
  - Evaluate Precision, Recall, and AUC-ROC on high-risk tiers (prioritize high recall on `PRIORITY` cases).
- [ ] **Task 8.3: Model Serving & Ensemble Fallback**
  - Package trained model with ONNX or joblib.
  - Implement dual-mode engine in backend: Weighted Rules (Primary baseline) + ML Score (Comparative validation).

---

## Phase 9: Google Health Connect Passive Ingestion (Consent-Based)

**Goal**: Integrate optional, passive physiological metrics via Android Health Connect API.

- [ ] **Task 9.1: Health Connect Permissions & Setup**
  - Check Health Connect availability (Android 14 system vs. Android 13 APK).
  - Implement granular permission request flow (Resting Heart Rate, Sleep Session, Steps).
- [ ] **Task 9.2: Background Passive Ingestion Worker**
  - Periodic `WorkManager` job querying daily sleep duration, sleep stages, and average resting HR.
  - Compute resting HR deviation and sleep deficit relative to user's 14-day passive baseline.
- [ ] **Task 9.3: Additive Risk Factor Integration**
  - Feed passive metrics into Feature Engineering pipeline.
  - Verify system degrades gracefully when permissions are denied or unavailable.

---

## Phase 10: End-to-End Hardening, Security Audits & Demo Rehearsal

**Goal**: Validate security boundaries, audit trails, and prepare a presentation-ready demonstration.

- [ ] **Task 10.1: Security & RBAC Penetration Audit**
  - Test unauthorized endpoint access (Commander attempting to fetch `GET /api/v1/personnel/{id}`).
  - Confirm all API keys (Anthropic, DB credentials) exist strictly in server environment variables.
- [ ] **Task 10.2: Crisis Escalation Path Rehearsal**
  - Live test of acute crisis trigger: immediate emergency screen on client + real-time notification to Wellness Officer within < 2 seconds.
- [ ] **Task 10.3: Demo Scenario Walkthrough**
  - Rehearse the 4 core demo scenarios:
    1. Personnel submitting daily check-in (~15s flow).
    2. Commander logging intense duty roster -> Unit aggregate shifts to elevated.
    3. Wellness Officer identifying emerging burnout via `CONFLICTING` badge.
    4. Crisis hotline trigger demonstrating parallel zero-AI pathway.
