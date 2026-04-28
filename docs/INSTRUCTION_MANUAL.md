# Instant Dashboard — Technical Instruction Manual

> **Version:** 1.3.0
> **Last Updated:** 2026-04-28
> **Audience:** Developers, Auditors, Systems Architects

---

## SECTION A – Full System Architecture

### High-Level Architecture
Instant Dashboard uses a **Serverless-First** approach built on Python/Flask and deployed to Vercel. This stateless architecture ensures scalability and reduces operational overhead.

The core flow is:
1.  **Client-Side Capture:** User inputs raw JSON data and styling prompts.
2.  **API Gateway:** Flask routes handle input validation.
3.  **Service Layer:** The backend orchestrates a call to the **Big Pickle** LLM using streaming for optimal time-to-first-byte.
4.  **Streaming Pipeline:** The backend streams chunks to the client via Server-Sent Events (SSE) while simultaneously buffering them for validation.
5.  **Sanitisation:** The final buffered HTML is strictly sanitised to strip executable code.
6.  **Presentation Layer:** The sanitised HTML is rendered inside a restrictive `sandbox` iframe to prevent XSS.

### Component Interaction Map
```mermaid
graph TD
    User[End User] -->|Inputs JSON + Prompt| UI[Frontend UI]
    UI -->|POST /api/generate-stream| API[Flask API]
    API -->|Validate Input| Validator[Validator Utils]
    API -->|Stream Request| Service[LLM Service]
    Service -->|Stream Response| LLM[LLM API]
    LLM -->|SSE Chunks| Service
    Service -->|Yield Chunk| API
    API -->|SSE Data Event| UI
    API -->|Buffer & Validate| Validator
    Validator -->|Invalid?| Retry[Trigger Auto-Retry (Max 3)]
    Retry -->|Valid?| Clean[Final Clean HTML]
    Clean -->|SSE Done Event| UI
    UI -->|Render| Iframe[Sandboxed Iframe]
```

---

## SECTION B – Frontend Technical Breakdown

### Module Architecture
The frontend uses **ES6 modules** loaded via `<script type="module">`. The monolithic script has been decomposed into four focused files:

| Module | Responsibility |
|--------|---------------|
| `js/generator.js` | Page orchestrator — imports all modules, owns the central `state` object, drives the single `render()` update loop |
| `js/data/samples.js` | Pure data — exports `SAMPLES` (3 JSON datasets) and `SAMPLE_PROMPTS` (matching design prompts) |
| `js/utils/dom.js` | DOM helpers — exports `showError()`, `hideError()`, `setLoading()`, `validateJSON()`. Receives DOM targets as arguments (no module-level queries). |
| `js/services/streamClient.js` | Network layer — exports `StreamClient` class that owns the `fetch → ReadableStream → SSE-parse` pipeline. Zero DOM knowledge; communicates via callbacks (`onChunk`, `onRetry`, `onDone`, `onError`). |

### Component List
- **`landing.html`**: Marketing page with CSS grid animations (`.bg-grid`).
- **`generate.html`**: The main application interface. Splits screen into sidebar (input) and main area (preview).
- **`json-input`**: A `textarea` specifically styled for code input (`font-family: monospace`).
- **`preview-iframe`**: Utilizing the `srcdoc` attribute to render HTML content without a round-trip.
- **`live-code-view`**: A scrolling view that displays the raw HTML as it streams in real-time.

### State Management
The frontend uses a **centralized state object** with a **single `render()` function** that reconciles the entire UI.

**State object keys:**
| Key | Type | Purpose |
|-----|------|---------|
| `isGenerating` | `boolean` | Controls button disabled state and spinner |
| `view` | `'code' \| 'preview'` | Active tab |
| `streamStatus` | `'idle' \| 'streaming' \| 'retrying' \| 'done' \| 'error'` | Status indicator dot + label |
| `errorMessage` | `string \| null` | Error banner content |
| `generatedHTML` | `string \| null` | Final sanitised HTML for preview/download |
| `rawCode` | `string` | Accumulated raw chunks for live code view |
| `charCount` | `number` | Character count displayed in stats bar |
| `iframeSrcdocSet` | `boolean` | Guards against iframe reload on tab switches |

Every user action or stream callback mutates `state`, then calls `render()`.

### XSS Prevention
The `renderCodeLines()` function uses **programmatic DOM construction** with `textContent` exclusively — no `innerHTML` — making it 100% XSS-proof regardless of what the LLM generates.

### Form Validation Logic
Client-side validation occurs before any network request:
1.  **JSON Format**: `JSON.parse()` is attempted in a `try/catch` block (via `dom.js → validateJSON()`).
2.  **Prompt Length**: Enforced via `maxlength` (500 chars).
3.  **Empty Fields**: Both JSON and Prompt are required.

---

## SECTION C – Backend Technical Breakdown

### Package Structure
| Package | Module | Purpose |
|---------|--------|---------|
| `api/` | `index.py` | Flask app — routes, SSE streaming, retry logic |
| `config/` | `prompts.py` | `SYSTEM_PROMPT` constant — single source of truth for LLM behavior rules |
| `services/` | `llm_service.py` | LLM streaming client — imports `SYSTEM_PROMPT` from `config.prompts` |
| `utils/` | `validator.py` | 4-stage HTML validation & sanitisation pipeline |

### Route Listing
| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Serves the landing page. |
| `/generate` | GET | Serves the generator tool UI. |
| `/api/generate` | POST | Legacy non-streaming endpoint. |
| `/api/generate-stream` | POST | Primary SSE streaming endpoint. |

### API Request Lifecycle (Streaming)
1.  **Payload Parsing**: Flask parses JSON body.
2.  **Validation**:
    - `validate_json_input`: Re-verifies JSON parseability.
    - `validate_prompt`: Checks length constraints.
3.  **LLM Integration & Auto-Retry Loop**:
    - Initiates a retry loop (up to 3 attempts) in case the LLM API routes to an incompatible model (e.g., reasoning-only model failing structure).
    - Constructs system prompt (from `config/prompts.py`) + user JSON and calls `services.llm_service.stream_llm`.
4.  **Streaming Response**:
    - Yields `event: data` payload `{"chunk": "..."}` for each token.
    - Handles reasoning model variations (e.g., buffering `delta.reasoning` if `delta.content` is empty).
    - Accumulates full content in memory.
5.  **Finalisation**:
    - Once stream ends, passes full content to `validate_html_output` (trims preamble, enforces DOCTYPE, sanitises URIs).
    - If valid, yields `event: done` with the sanitised HTML.
    - If invalid and retries remain, yields `event: retry` causing client to reset view.
    - If invalid and retries exhausted, yields `event: error`.

---

## SECTION D – Database Documentation

### Architecture
This application is **Stateless**. No user data is persisted.

- **Data Persistence**: None. All data is transient in memory.
- **Session Storage**: None.

---

## SECTION E – Authentication Flow

### Service Authentication
- **API Keys**: Access to the LLM API is secured via `LLM_API_KEY`.
- **Environment Variables**: Injected at runtime (`LLM_API_KEY`, `LLM_MODEL`, `LLM_API_URL`).

---

## SECTION F – Integration Points

### External APIs
1.  **OpenAI-Compatible LLM API (e.g. OpenCode.ai, NVIDIA NIM)**
    - **Endpoint**: Configurable via `LLM_API_URL`
    - **Method**: POST
    - **Headers**: `Authorization: Bearer <KEY>`
    - **Features**: SSE Streaming, handles standard `content` or `reasoning` chunk patterns.

---

## SECTION G – Security Considerations

### 1. Input Validation
- **Double Validation**: JSON parsed on client and server.
- **Size Limits**: Prompts capped at 500 chars.

### 2. Output Sanitisation & Sandboxing (XSS Prevention)
- **Server-Side**: Regex-based removal of malicious `javascript:` URIs from attributes. (Note: `<script>` tags and standard event handlers are intentionally allowed for dashboard interactivity).
- **Client-Side**: The generated HTML is safely rendered in an `iframe` with the `sandbox="allow-same-origin allow-scripts"` attribute. This allows the dashboard's own JavaScript to execute (for charts/animations), but completely blocks access to the parent page DOM, prevents form submissions, and disables popups.

### 3. Data Privacy
- No user data logged to persistent storage.
- Logs capture metadata only (size, status).
