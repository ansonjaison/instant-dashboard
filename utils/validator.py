"""Input / output validation and sanitisation utilities.

Provides helpers for validating user-supplied JSON, enforcing prompt
length limits, stripping markdown fences, and sanitising LLM-generated
HTML to prevent XSS.
"""

import json
import logging
import re

logger = logging.getLogger(__name__)


def validate_json_input(json_string: str) -> dict:
    """Validate that the input string is parseable JSON.

    Returns:
        dict: ``{"valid": True, "data": <parsed>}``
              or ``{"valid": False, "error": "..."}``.
    """
    if not json_string or not json_string.strip():
        return {"valid": False, "error": "JSON data cannot be empty."}

    try:
        parsed = json.loads(json_string)
        return {"valid": True, "data": parsed}
    except json.JSONDecodeError as exc:
        return {"valid": False, "error": f"Invalid JSON: {exc}"}


def validate_prompt(prompt: str, max_length: int = 500) -> dict:
    """Validate the user's design prompt.

    Returns:
        dict: ``{"valid": True}``
              or ``{"valid": False, "error": "..."}``.
    """
    if not prompt or not prompt.strip():
        return {"valid": False, "error": "Design prompt cannot be empty."}

    if len(prompt) > max_length:
        return {
            "valid": False,
            "error": f"Design prompt must be {max_length} characters or less.",
        }

    return {"valid": True}


def strip_markdown_fences(html: str) -> str:
    """Strip markdown code fences that LLMs sometimes wrap around HTML.

    Handles ````` ```html ... ``` `````, ````` ```HTML ... ``` `````,
    and plain ````` ``` ... ``` `````.
    """
    stripped = html.strip()

    # Remove opening markdown fence
    stripped = re.sub(r"^```(?:html|HTML)?\s*\n?", "", stripped)

    # Remove closing markdown fence
    stripped = re.sub(r"\n?```\s*$", "", stripped)

    return stripped.strip()


def sanitize_html(html: str) -> str:
    """Remove dangerous elements from HTML.

    Strips ``<script>`` tags, ``on*`` event handlers, and
    ``javascript:`` protocol URIs.
    """
    # Remove <script>…</script> tags and content
    sanitized = re.sub(
        r"<script\b[^>]*>[\s\S]*?</script>", "", html, flags=re.IGNORECASE
    )

    # Remove standalone <script> tags (self-closing or unclosed)
    sanitized = re.sub(
        r"<script\b[^>]*/?\\s*>", "", sanitized, flags=re.IGNORECASE
    )

    # Remove on* event handlers from tags
    sanitized = re.sub(r'\bon\w+\s*=\s*"[^"]*"', "", sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r"\bon\w+\s*=\s*'[^']*'", "", sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r"\bon\w+\s*=\s*\S+", "", sanitized, flags=re.IGNORECASE)

    # Remove javascript: protocol
    sanitized = re.sub(
        r'href\s*=\s*"javascript:[^"]*"', 'href="#"', sanitized, flags=re.IGNORECASE
    )
    sanitized = re.sub(
        r"href\s*=\s*'javascript:[^']*'", "href='#'", sanitized, flags=re.IGNORECASE
    )
    sanitized = re.sub(
        r'src\s*=\s*"javascript:[^"]*"', 'src=""', sanitized, flags=re.IGNORECASE
    )

    return sanitized


def validate_html_output(raw_html: str) -> dict:
    """Run the full validation pipeline on LLM output.

    Steps:
        1. Strip markdown fences.
        2. Verify ``<!DOCTYPE html>``.
        3. Check for ``<html>`` and ``<body>`` tags.
        4. Sanitise dangerous content.

    Returns:
        dict: ``{"valid": True, "html": "<clean>"}``
              or ``{"valid": False, "error": "..."}``.
    """
    if not raw_html or not raw_html.strip():
        return {"valid": False, "error": "LLM returned empty output."}

    # Step 1: Strip markdown fences
    html = strip_markdown_fences(raw_html)

    # Step 2: Check for DOCTYPE
    if not re.match(r"<!DOCTYPE\s+html", html, re.IGNORECASE):
        doctype_match = re.search(r"<!DOCTYPE\s+html", html[:500], re.IGNORECASE)
        if doctype_match:
            html = html[doctype_match.start():]
        else:
            logger.warning("LLM output missing <!DOCTYPE html>")
            return {"valid": False, "error": "LLM did not return valid HTML. Please try again."}

    # Step 3: Verify basic structure
    if not re.search(r"<html", html, re.IGNORECASE):
        return {"valid": False, "error": "LLM output is missing <html> tag."}

    if not re.search(r"<body", html, re.IGNORECASE):
        return {"valid": False, "error": "LLM output is missing <body> tag."}

    # Step 4: Sanitise
    html = sanitize_html(html)

    return {"valid": True, "html": html}
