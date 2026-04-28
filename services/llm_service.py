"""LLM service layer.

Handles prompt assembly, Big Pickle API invocation with streaming,
and response extraction.
"""

import json
import logging
import os

import requests

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a senior data analyst and professional frontend developer "
    "specialized in creating clean, modern HTML dashboards using only HTML and CSS.\n\n"
    "Your task is to generate a complete, self-contained HTML document based strictly "
    "on the provided JSON data and the user's design instructions.\n\n"
    "STRICT RULES:\n\n"
    "1. Output ONLY a valid, complete HTML document starting with <!DOCTYPE html>.\n"
    "2. Use inline CSS inside <style> tags. Do NOT use external libraries, CDNs, or external files.\n"
    "3. Do NOT include markdown, explanations, comments, or code fences.\n"
    "4. Use ONLY the data provided in the JSON. Do NOT fabricate, estimate, calculate new values, "
    "or modify any numbers.\n"
    "5. Every numeric value shown in the dashboard must exactly match the JSON.\n"
    "6. If required data is missing, display \"Data Unavailable\" clearly in that section.\n"
    "7. The layout must be clean, readable, professional, and well-spaced.\n"
    "8. Follow the user's visual/design instructions precisely (colors, layout style, emphasis, structure).\n"
    "9. If the JSON contains lists or repeated structures, represent them appropriately "
    "(e.g., tables, sections, or visual groupings).\n"
    "10. The final output must be directly renderable in a browser without any modification.\n\n"
    "Return only the final HTML document."
)


def _build_payload(json_data: str, user_prompt: str) -> tuple:
    """Build headers and payload for the Big Pickle API call.

    Returns:
        tuple: ``(headers, payload, api_url)``

    Raises:
        ValueError: If the API key is not configured.
    """
    api_key = os.environ.get("LLM_API_KEY")
    model = os.environ.get("LLM_MODEL", "minimax-m2.5-free")
    api_url = os.environ.get(
        "LLM_API_URL",
        "https://opencode.ai/zen/v1/chat/completions",
    )

    logger.info("API URL: %s | Model: %s | Key present: %s (len=%d)",
                api_url, model, bool(api_key), len(api_key or ""))

    if not api_key:
        raise ValueError("Server configuration error: API key missing.")

    user_message = (
        "Here is the JSON data for the dashboard:\n\n"
        f"```json\n{json_data}\n```\n\n"
        f"Design instructions: {user_prompt}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": 8000,
        "temperature": 0.3,
        "top_p": 0.7,
        "stream": True,
    }

    return headers, payload, api_url


def stream_llm(json_data: str, user_prompt: str):
    """Yield individual content chunks from the Big Pickle API.

    Used by the SSE streaming endpoint to push code to the browser
    in real-time.

    Yields:
        str: Individual text chunks as they arrive from the LLM.

    Raises:
        Exception: Propagated so the SSE endpoint can send an error event.
    """
    try:
        headers, payload, api_url = _build_payload(json_data, user_prompt)
    except ValueError as exc:
        logger.error(str(exc))
        raise

    try:
        response = requests.post(
            api_url,
            headers=headers,
            json=payload,
            timeout=120,
            stream=True,
        )

        logger.info("API response status: %d", response.status_code)
        logger.info("API response headers: %s", dict(response.headers))

        if response.status_code != 200:
            error_detail = response.text[:300]
            logger.error(
                "Big Pickle API error %d: %s",
                response.status_code,
                error_detail,
            )
            raise Exception(
                f"LLM API returned status {response.status_code}. Please try again."
            )

        chunk_count = 0
        reasoning_buf = ""  # fallback for reasoning-only models

        for line in response.iter_lines():
            if not line:
                continue

            line = line.decode("utf-8")
            logger.debug("RAW LINE: %s", line[:300])

            if not line.strip() or line.startswith(":"):
                continue

            if line.startswith("data: "):
                data_str = line[6:]

                if data_str.strip() == "[DONE]":
                    logger.info("Stream done. Total chunks yielded: %d", chunk_count)
                    break

                try:
                    chunk_data = json.loads(data_str)
                    choices = chunk_data.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {})
                    chunk_content = delta.get("content", "")
                    chunk_reasoning = delta.get("reasoning", "") or ""

                    if chunk_content:
                        chunk_count += 1
                        yield chunk_content
                    elif chunk_reasoning:
                        # Reasoning model: accumulate reasoning text as fallback
                        reasoning_buf += chunk_reasoning

                except json.JSONDecodeError as exc:
                    logger.warning("Failed to parse streaming chunk: %s", exc)
                    continue

        if chunk_count == 0:
            if reasoning_buf.strip():
                # Reasoning model returned content only in delta.reasoning —
                # yield the entire accumulated reasoning as one chunk.
                logger.warning(
                    "content was empty; falling back to reasoning field (%d chars).",
                    len(reasoning_buf),
                )
                yield reasoning_buf
            else:
                logger.warning("Stream ended with ZERO content chunks.")

    except requests.exceptions.Timeout:
        logger.error("Big Pickle API request timed out.")
        raise Exception("LLM request timed out. Please try again.")
    except requests.exceptions.ConnectionError:
        logger.error("Failed to connect to Big Pickle API.")
        raise Exception("Failed to connect to the LLM service.")
    except requests.exceptions.RequestException as exc:
        logger.error("Big Pickle request failed: %s", exc)
        raise Exception("An unexpected error occurred while calling the LLM.")


def call_llm(json_data: str, user_prompt: str) -> dict:
    """Call the Big Pickle API and return the complete response.

    Internally consumes ``stream_llm`` and concatenates all chunks.

    Args:
        json_data: The raw JSON string provided by the user.
        user_prompt: The user's natural-language styling instructions.

    Returns:
        dict: ``{"success": True, "html": "..."}``
              or ``{"success": False, "error": "..."}``.
    """
    try:
        content = ""
        for chunk in stream_llm(json_data, user_prompt):
            content += chunk

        if not content.strip():
            logger.error("Big Pickle response content was empty.")
            return {"success": False, "error": "LLM returned empty content."}

        logger.info(
            "Successfully received %d characters from Big Pickle (streamed)",
            len(content),
        )
        return {"success": True, "html": content}

    except Exception as exc:
        logger.error("LLM call failed: %s", exc)
        return {"success": False, "error": str(exc)}
