# ⚡ Instant Dashboard

**Problem Statement**
Business data is often stuck in raw JSON formats, requiring expensive BI tools or custom engineering to visualize. Non-technical users struggle to turn structured data into actionable insights instantly without waiting for development cycles.

**Solution Description**
Instant Dashboard is an AI-powered visualization engine that transforms raw JSON data into professional, self-contained HTML dashboards in seconds. By leveraging the **Big Pickle** LLM with advanced streaming architecture, it interprets data structures and generates custom-styled, responsive dashboards on the fly — no coding required.

**Technology Stack**
- **Frontend:** Vanilla HTML5, CSS3 (Glassmorphism), JavaScript (ES6+)
- **Backend:** Python + Flask (Serverless Architecture)
- **AI Engine:** Big Pickle (via OpenCode.ai API)
- **Infrastructure:** Vercel
- **Security:** Sandboxed Iframe Rendering, Server-side HTML Sanitisation

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
   BIG_PICKLE_API_KEY=your_key_here
   BIG_PICKLE_MODEL=big-pickle
   BIG_PICKLE_API_URL=https://opencode.ai/zen/v1/chat/completions
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

The system follows a strict **Stateless Serverless** pattern to ensure scalability and security.

```
[User Browser]
  │
  ├── (1) POST JSON + Prompt
  ▼
[Flask API Layer] (Vercel Serverless Function)
  │
  ├── (2) Input Validation (JSON Schema + Length Checks)
  │
  ├── (3) Streaming Request (SSE)
  ▼
[Big Pickle LLM Engine]
  │
  ├── (4) Generates HTML/CSS Stream
  ▼
[Output Validator]
  │
  ├── (5) Strict HTML Parsing (Ensure <!DOCTYPE html>)
  │
  ├── (6) Anti-XSS Sanitisation (Strip <script>, on* events)
  ▼
[User Browser]
  │
  └── (7) Renders inside Sandboxed Iframe
```

## 📁 Folder Structure

```
/
├── api/                  # Server-side logic
│   └── index.py          # Main Flask application entry point
├── services/             # External integration services
│   └── llm_service.py    # Big Pickle integration with streaming
├── utils/                # Shared utilities
│   └── validator.py      # Security & validation logic
├── templates/            # HTML Templates (Jinja2)
│   ├── landing.html      # Marketing / landing page
│   └── generate.html     # Main application UI
├── static/               # Static assets
│   ├── css/style.css     # Design system & global styles
│   └── js/generator.js   # Client-side interactive logic
└── docs/                 # Detailed technical documentation
    ├── INSTRUCTION_MANUAL.md
    └── PROJECT_LOG.md
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

Same request body as above. The response is an `text/event-stream` with
the following event types:

| Event | Data | Description |
|-------|------|-------------|
| *(default)* | `{"chunk": "..."}` | A piece of generated code |
| `done` | `{"html": "..."}` | Final sanitised HTML |
| `error` | `{"error": "..."}` | Error message |

## 🛡 Database Overview

This project utilises a **Stateless** approach. No user data is persisted. All state is ephemeral and exists only during the request lifecycle, ensuring maximum privacy and zero data liability.

## 🌍 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BIG_PICKLE_API_KEY` | Yes | Authentication key for OpenCode.ai |
| `BIG_PICKLE_MODEL` | No | Model ID (default: `big-pickle`) |
| `BIG_PICKLE_API_URL` | No | API endpoint (default: `https://opencode.ai/zen/v1/chat/completions`) |

## 🎮 Demo Instructions

1. Open the application.
2. Paste valid JSON (or use the "Sales Data" sample button).
3. Type a prompt like: *"Create a dark-themed dashboard with gradient cards."*
4. Click **Generate**.
5. Watch the code stream live, then see the dashboard render in the preview.
