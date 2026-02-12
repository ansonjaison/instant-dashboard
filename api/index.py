"""Flask application entry point — API and page routes.

Serves the landing page, generator page, and the ``/api/generate`` and
``/api/generate-stream`` endpoints.
"""

import os
import sys
import json
import logging
from flask import Flask, request, jsonify, render_template, Response

# ---------------------------------------------------------------------------
# Path setup — single authoritative project root
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from services.llm_service import call_llm, stream_llm
from utils.validator import validate_json_input, validate_prompt, validate_html_output

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(
    __name__,
    template_folder=os.path.join(PROJECT_ROOT, "templates"),
    static_folder=os.path.join(PROJECT_ROOT, "static"),
)


# ---------------------------------------------------------------------------
# Page routes
# ---------------------------------------------------------------------------

@app.route("/")
def landing():
    """Serve the premium landing page."""
    return render_template("landing.html")


@app.route("/generate")
def generate_page():
    """Serve the dashboard generator page."""
    return render_template("generate.html")


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.route("/api/generate", methods=["POST"])
def api_generate():
    """Generate a dashboard (non-streaming).

    Accepts JSON: ``{"json_data": "...", "user_prompt": "..."}``
    Returns JSON: ``{"success": true, "html": "..."}``
    or ``{"success": false, "error": "..."}``
    """
    # --- Parse request body ---
    try:
        body = request.get_json(force=True)
    except Exception:
        return jsonify({"success": False, "error": "Invalid request body."}), 400

    if not body:
        return jsonify({"success": False, "error": "Request body is required."}), 400

    json_data = body.get("json_data", "")
    user_prompt = body.get("user_prompt", "")

    # --- Validate JSON input ---
    json_result = validate_json_input(json_data)
    if not json_result["valid"]:
        return jsonify({"success": False, "error": json_result["error"]}), 400

    # --- Validate user prompt ---
    prompt_result = validate_prompt(user_prompt)
    if not prompt_result["valid"]:
        return jsonify({"success": False, "error": prompt_result["error"]}), 400

    # --- Call LLM ---
    logger.info("Calling LLM with %d bytes of JSON and prompt: '%s'", len(json_data), user_prompt[:80])
    llm_result = call_llm(json_data, user_prompt)

    if not llm_result["success"]:
        return jsonify({"success": False, "error": llm_result["error"]}), 500

    # --- Validate LLM output ---
    html_result = validate_html_output(llm_result["html"])

    if not html_result["valid"]:
        logger.warning("LLM output failed validation: %s", html_result["error"])
        return jsonify({"success": False, "error": html_result["error"]}), 500

    logger.info("Successfully generated dashboard HTML (%d bytes)", len(html_result["html"]))
    return jsonify({"success": True, "html": html_result["html"]}), 200


@app.route("/api/generate-stream", methods=["POST"])
def api_generate_stream():
    """Generate a dashboard via Server-Sent Events (SSE).

    Accepts JSON: ``{"json_data": "...", "user_prompt": "..."}``

    SSE event types emitted:
      - ``data: {"chunk": "..."}`` — a piece of generated code
      - ``event: done``, ``data: {"html": "..."}`` — final sanitised HTML
      - ``event: error``, ``data: {"error": "..."}`` — error message
    """
    # --- Parse request body ---
    try:
        body = request.get_json(force=True)
    except Exception:
        return jsonify({"success": False, "error": "Invalid request body."}), 400

    if not body:
        return jsonify({"success": False, "error": "Request body is required."}), 400

    json_data = body.get("json_data", "")
    user_prompt = body.get("user_prompt", "")

    # --- Validate JSON input ---
    json_result = validate_json_input(json_data)
    if not json_result["valid"]:
        return jsonify({"success": False, "error": json_result["error"]}), 400

    # --- Validate user prompt ---
    prompt_result = validate_prompt(user_prompt)
    if not prompt_result["valid"]:
        return jsonify({"success": False, "error": prompt_result["error"]}), 400

    logger.info("Streaming LLM with %d bytes of JSON and prompt: '%s'", len(json_data), user_prompt[:80])

    def event_stream():
        """Yield SSE-formatted events from the LLM stream."""
        full_content = ""
        try:
            for chunk in stream_llm(json_data, user_prompt):
                full_content += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"

            if not full_content.strip():
                yield f"event: error\ndata: {json.dumps({'error': 'LLM returned empty content.'})}\n\n"
                return

            # Validate & sanitise the complete HTML
            html_result = validate_html_output(full_content)

            if not html_result["valid"]:
                logger.warning("Streamed LLM output failed validation: %s", html_result["error"])
                yield f"event: error\ndata: {json.dumps({'error': html_result['error']})}\n\n"
                return

            logger.info("Successfully streamed dashboard HTML (%d bytes)", len(html_result["html"]))
            yield f"event: done\ndata: {json.dumps({'html': html_result['html']})}\n\n"

        except Exception as exc:
            logger.error("Stream error: %s", exc)
            yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"

    return Response(
        event_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# Local development server
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
    app.run(debug=True, port=5000)
