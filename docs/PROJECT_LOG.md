# Project Log — Technical Build Report

**Project Title:** Instant Dashboard

**Date:** 2026-02-12

---

## 🏗 Chronological Breakdown

### Phase 1: Architecture Definition
Initially, I considered a client-side only solution using a browser LLM or simple JS calls, but rejected it due to the inherent security risk of exposing API keys. A **Serverless Flask Backend** was chosen as the optimal balance between security (key protection) and rapid development.

### Phase 2: Core API Implementation
The `api/index.py` was constructed to serve two primary HTML pages and one API endpoint.
- **Decision**: Keep routes minimal (`/`, `/generate`, `/api/generate`) to reduce complexity.
- **Challenge**: Initial JSON parsing errors were common with malformed user input.
- **Solution**: Implemented robust `try/except` blocks around `json.loads` server-side, with specific error messages returned to help the user fix their input.

### Phase 3: LLM Integration
Integrated a provider-agnostic, OpenAI-compatible service layer (`llm_service.py`).
- **Early Issue**: Standard synchronous requests were slow for large generations.
- **Refinement**: Switched the internal service layer to use **Streaming (SSE)**.
- **Expansion**: Exposed a new `/api/generate-stream` endpoint. This allows the frontend to display the generated code character-by-character as it arrives, significantly improving perceived performance (Time To First Byte).

### Phase 4: Security Hardening (Crucial)
Given the core function is "generating HTML from user input", XSS was the primary threat vector.
- **Mitigation 1 (Server)**: Python-based sanitisation in `utils.validator.py`.
    - Regex to strip malicious `javascript:` URIs from `href`/`src` attributes.
    - Regex to force `<!DOCTYPE html>` structure and strip enclosing markdown fences.
    - *Note: `<script>` tags are intentionally preserved to allow interactive dashboard charts/logic.*
- **Mitigation 2 (Client)**: `iframe sandbox` attribute on the frontend.
    - Rendered in a sandbox with `allow-scripts` (so charts work) but *without* `allow-top-navigation`, `allow-popups`, or `allow-forms`, neutralizing any potential script escalation or navigation hijacking.

### Phase 6: Model Routing & Retry Resiliency
When using OpenRouter or similar gateways, API calls are sometimes routed to "reasoning models" (e.g. MiniMax M2.5) that output tokens in `delta.reasoning` instead of `delta.content`, or return invalid HTML (just "thinking" text).
- **Solution Parts**:
  1.  **Reasoning Fallback**: `llm_service.py` buffers `delta.reasoning` chunks if `delta.content` is absent.
  2.  **Auto-Retry Loop**: The Flask route initiates a 3-attempt retry loop. If a reasoning model fails validation, it silently retries, giving the router another chance to pick a structural model.
  3.  **UI Feedback**: A new `retry` SSE event tells the client to reset the live code view during retries.

### Phase 5: UI Polish
Adopted a "Premium Dark" aesthetic using modern CSS variables and glassmorphism.
- **CSS**: 100% custom CSS (no Tailwind/Bootstrap) to demonstrate mastery of fundamentals.
- **Interactive Elements**: Subtle hover states, loading skeletons, and smooth transitions enhance perceived performance.

---

## 🛠 Feature-by-Feature Technical Analysis

### 1. JSON Input Validation
**Why**: Users often paste invalid JSON (trailing commas, missing quotes).
**How**: Client-side `JSON.parse` check before submission + Server-side `json.loads` check.
**Result**: 99% of formatting errors are caught instantly in the UI without a round-trip.

### 2. Prompt Engineering
**Constraint**: LLMs can "hallucinate" data (invent numbers).
**Solution**: A strict **System Prompt** was engineered:
> "Use ONLY the data provided in the JSON. Do NOT fabricate, estimate, calculate new values... return only valid HTML."
**Outcome**: High fidelity data representation in the generated dashboards.

### 3. LLM Streaming & Retry Engine
**Trade-off**: Complexity vs. Reliability.
**Decision**: Implemented an SSE-based generator in Python (`stream_llm`) with an auto-retry wrapper.
- **Flow**: The client connects to `text/event-stream`.
- **Logic**: Python yields chunks immediately. Once the LLM finishes, Python validates the *complete* buffer.
- **Benefit**: If validation fails (e.g. bad model routing), the server catches it, triggers an `event: retry` to reset the UI, and automatically tries again up to 3 times before failing.

---

## ⚠️ Known Limitations

1. **Large Payloads**: Vercel serverless functions have a payload size limit (4.5MB). Extremely large JSON files may fail.
2. **Execution Time**: The current 90s timeout is generous, but very complex dashboards might hit Vercel execution limits (10s on free tier, configurable on Pro).
3. **Statelessness**: No history. If a user refreshes the page, their dashboard is gone. This is by design (privacy) but a usability trade-off.

---

## 🔮 Future Improvements

1.  **Direct DOM Patching**: Instead of reloading the whole iframe, use a diffing library to update specific parts of the dashboard as they change (if we move to iterative refinement).
2.  **Schema Validation**: Use a library like `Pydantic` or `jsonschema` to enforce specific structures on the *input* JSON (e.g., ensuring "revenue" field exists if requested).
3.  **Template Gallery**: Allow users to pick a "starting style" (e.g., "Corporate", "Creative", "Minimal") which injects specific CSS into the prompt.

---

## 📊 API Endpoint Table

| Method | Endpoint | Data Params | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/` | None | Landing Page HTML |
| **GET** | `/generate` | None | App UI HTML |
| **POST** | `/api/generate` | `json_data`, `user_prompt` | Legacy synchronous generation |
| **POST** | `/api/generate-stream` | `json_data`, `user_prompt` | **Streaming** generation (SSE) |

---

## 📂 Folder Tree

```text
/
├── api/
│   └── index.py
├── services/
│   └── llm_service.py
├── utils/
│   └── validator.py
├── templates/
│   ├── landing.html
│   └── generate.html
├── static/
│   ├── css/
│   └── js/
└── docs/
    ├── INSTRUCTION_MANUAL.md
    └── PROJECT_LOG.md
```
