/**
 * StreamClient — SSE streaming client for the dashboard generation API.
 *
 * Owns the fetch → ReadableStream → SSE-parse pipeline.
 * Zero DOM knowledge — communicates results via callbacks.
 */

export class StreamClient {
    /**
     * @param {string} url – API endpoint (e.g. '/api/generate-stream')
     */
    constructor(url) {
        this.url = url;
    }

    /**
     * Start a streaming generation request.
     *
     * @param {Object}   payload            – request body (json_data, user_prompt)
     * @param {Object}   callbacks
     * @param {function} callbacks.onChunk  – called with each code chunk string
     * @param {function} callbacks.onRetry  – called when the server retries (bad model, etc.)
     * @param {function} callbacks.onDone   – called with the final sanitised HTML string
     * @param {function} callbacks.onError  – called with an error message string
     * @returns {Promise<void>}
     */
    async stream(payload, { onChunk, onRetry, onDone, onError }) {
        try {
            const response = await fetch(this.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                // Non-SSE error (validation fail, etc.)
                let msg = 'Generation failed. Please try again.';
                try {
                    const errorData = await response.json();
                    msg = errorData.error || msg;
                } catch (_) { /* response wasn't JSON */ }
                onError(msg);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE events (double-newline separated)
                const events = buffer.split('\n\n');
                buffer = events.pop(); // Keep incomplete chunk in buffer

                for (const eventBlock of events) {
                    if (!eventBlock.trim()) continue;

                    const lines = eventBlock.split('\n');
                    let eventType = null;
                    let data = null;

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.slice(7).trim();
                        } else if (line.startsWith('data: ')) {
                            data = line.slice(6);
                        }
                    }

                    if (data === null) continue;

                    try {
                        const parsed = JSON.parse(data);

                        if (eventType === 'error') {
                            onError(parsed.error || 'Generation failed.');
                            return;
                        }

                        if (eventType === 'retry') {
                            onRetry(parsed);
                            continue;
                        }

                        if (eventType === 'done') {
                            onDone(parsed.html);
                            return;
                        }

                        // Default data event (chunk)
                        if (parsed.chunk) {
                            onChunk(parsed.chunk);
                        }
                    } catch (parseErr) {
                        console.warn('Failed to parse SSE data:', parseErr);
                    }
                }
            }

            // If we exit the loop without a 'done' event, something went wrong.
            // The orchestrator should detect this via the absence of an onDone call.
            onError('Stream ended unexpectedly. Please try again.');

        } catch (err) {
            if (err.name === 'AbortError') {
                onError('Request timed out. Please try again.');
            } else {
                onError('Network error. Please check your connection and try again.');
            }
            console.error('StreamClient error:', err);
        }
    }
}
