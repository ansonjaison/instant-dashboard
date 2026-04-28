# ⚡ Instant Dashboard

**Problem Statement**
Business data is often stuck in raw JSON formats, requiring expensive BI tools or custom engineering to visualize. Non-technical users struggle to turn structured data into actionable insights instantly without waiting for development cycles.

**Solution Description**
Instant Dashboard is an AI-powered visualization engine that transforms raw JSON data into professional, self-contained HTML dashboards in seconds. It uses a streaming LLM with an OpenAI-compatible API to interpret data structures and generate custom-styled, responsive dashboards on the fly — no coding required.

**Technology Stack**
- **Frontend:** Vanilla HTML5, CSS3 (Glassmorphism), JavaScript (ES6+)
- **Backend:** Python + Flask
- **AI Engine:** Any OpenAI-compatible LLM API (OpenCode Zen / NVIDIA NIM)
- **Infrastructure:** Vercel-compatible serverless
- **Security:** Sandboxed iframe rendering, server-side HTML sanitisation, auto-retry on bad model routing

## 🚀 Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/instant-dashboard.git
   cd instant-dashboard
   ```

2. **Configure Environment**
   Copy `.env.example` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   ```env
   # Required
   LLM_API_KEY=your_api_key_here

   # Optional — defaults to OpenCode Zen / minimax-m2.5-free
   LLM_MODEL=minimax-m2.5-free
   LLM_API_URL=https://opencode.ai/zen/v1/chat/completions
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run Locally**
   ```bash
   python api/index.py
   ```
   Access the application at `http://localhost:5000`

## 🏗 Architecture Overview

The system follows a **Stateless Serverless** pattern to ensure scalability and security.

```
[User Browser]
  │
  ├── (1) POST JSON + Prompt
  ▼
[Flask API Layer]
  │
  ├── (2) Input Validation (JSON + prompt length)
  │
  ├── (3) Streaming SSE request (up to 3 auto-retries on bad model routing)
  ▼
[LLM Engine — OpenAI-compatible API]
  │
  ├── (4) Generates HTML/CSS stream (delta.content or delta.reasoning fallback)
  ▼
[Output Validator]
  │
  ├── (5) Strip markdown fences (handles preamble text)
  ├── (6) Strict HTML parsing (ensure <!DOCTYPE html>)
  ├── (7) javascript: URI sanitisation
  ▼
[User Browser]
  │
  └── (8) Renders inside sandboxed iframe (allow-scripts, no top-navigation)
```

## 📁 Folder Structure

```
/
├── api/                          # Server-side logic
│   └── index.py                  # Flask app — routes, SSE streaming, retry logic
├── config/                       # Configuration & prompt templates
│   └── prompts.py                # SYSTEM_PROMPT (LLM behavior rules)
├── services/                     # External integrations
│   └── llm_service.py            # LLM streaming client (OpenAI-compatible)
├── utils/                        # Shared utilities
│   └── validator.py              # Validation & sanitisation pipeline
├── templates/                    # Jinja2 HTML templates
│   ├── landing.html              # Landing page
│   └── generate.html             # Generator UI
├── static/                       # Static assets
│   ├── css/
│   │   ├── style.css             # Import manifest (~35 lines, @import TOC)
│   │   ├── base/                 # _variables.css, _reset.css, _typography.css
│   │   ├── layout/               # _grid.css, _navigation.css, _footer.css, _generator-layout.css
│   │   ├── components/           # _buttons.css, _cards.css, _forms.css, _preview.css, etc.
│   │   ├── effects/              # _backgrounds.css, _animations.css
│   │   └── responsive/           # _breakpoints.css
│   └── js/
│       ├── generator.js          # Page orchestrator (state-driven render loop)
│       ├── data/samples.js       # Sample JSON datasets & design prompts
│       ├── utils/dom.js          # DOM utility functions
│       └── services/streamClient.js  # SSE streaming client class
├── .env.example                  # Environment variable template
└── docs/                         # Technical documentation
    ├── INSTRUCTION_MANUAL.md
    ├── PROJECT_LOG.md
    └── project_doc.md
```

## 🔗 API Overview

### `POST /api/generate` — Non-streaming

**Request:**
```json
{
  "json_data": "{\"revenue\": 50000}",
  "user_prompt": "Dark mode executive summary"
}
```

**Response:**
```json
{
  "success": true,
  "html": "<!DOCTYPE html><html>...</html>"
}
```

### `POST /api/generate-stream` — SSE Streaming

Same request body as above. Response is `text/event-stream` with the following event types:

| Event | Data | Description |
|-------|------|-------------|
| *(default)* | `{"chunk": "..."}` | A piece of generated code |
| `retry` | `{"attempt": N}` | Server retrying (bad model route) — client resets live view |
| `done` | `{"html": "..."}` | Final sanitised HTML |
| `error` | `{"error": "..."}` | Error message after all retries exhausted |

## 🌍 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_API_KEY` | **Yes** | — | API key for your LLM provider |
| `LLM_MODEL` | No | `minimax-m2.5-free` | Model ID |
| `LLM_API_URL` | No | `https://opencode.ai/zen/v1/chat/completions` | OpenAI-compatible endpoint |

### Supported Providers

| Provider | Model example | API URL |
|----------|--------------|---------|
| OpenCode Zen (recommended) | `minimax-m2.5-free` | `https://opencode.ai/zen/v1/chat/completions` |
| NVIDIA NIM | `meta/llama-3.1-8b-instruct` | `https://integrate.api.nvidia.com/v1/chat/completions` |

## 🔒 Security Model

- **Iframe sandbox:** Generated dashboards run in `sandbox="allow-same-origin allow-scripts"` — scripts execute but cannot navigate the parent page, open popups, or submit forms externally.
- **HTML sanitisation:** `javascript:` URIs are stripped from `href`/`src` attributes. Inline `<script>` blocks are allowed for dashboard interactivity.
- **Input validation:** JSON is parsed server-side; prompts are capped at 500 characters.
- **Stateless:** No user data is persisted. All state is ephemeral within the request lifecycle.

## 🎮 Demo Instructions

1. Open the application at `http://localhost:5000`.
2. Click **Sales Data**, **Analytics**, or **HR Report** to auto-fill both the JSON and a matching design prompt.
3. Optionally customise the prompt, then click **Generate**.
4. Watch code stream live in the Code view, then the dashboard auto-renders in the Preview tab.
5. Click **Download HTML** to save a standalone copy.
