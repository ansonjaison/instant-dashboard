/**
 * Instant Dashboard — Generator Page Orchestrator
 *
 * Thin coordinator that imports data, DOM utilities, and the streaming
 * client, then wires them together via a central state object and a
 * single render() function.
 */

import { SAMPLES, SAMPLE_PROMPTS } from './data/samples.js';
import { showError, hideError, setLoading, validateJSON } from './utils/dom.js';
import { StreamClient } from './services/streamClient.js';

// ── DOM References ──────────────────────────────────────────────────────
const jsonInput          = document.getElementById('json-input');
const promptInput        = document.getElementById('prompt-input');
const charCounter        = document.getElementById('char-counter');
const btnGenerate        = document.getElementById('btn-generate');
const btnGenText         = document.getElementById('btn-generate-text');
const btnSpinner         = document.getElementById('btn-spinner');
const btnDownload        = document.getElementById('btn-download');
const errorMessage       = document.getElementById('error-message');
const errorText          = document.getElementById('error-text');
const previewPlaceholder = document.getElementById('preview-placeholder');
const previewToolbar     = document.getElementById('preview-toolbar');
const previewIframe      = document.getElementById('preview-iframe');
const liveCodeView       = document.getElementById('live-code-view');
const liveCodeOutput     = document.getElementById('live-code-output');
const tabCode            = document.getElementById('tab-code');
const tabPreview         = document.getElementById('tab-preview');
const statsChars         = document.getElementById('stats-chars');
const statsDot           = document.getElementById('stats-dot');
const statsLabel         = document.getElementById('stats-label');

// ── Stream Client ───────────────────────────────────────────────────────
const client = new StreamClient('/api/generate-stream');

// ── Application State ───────────────────────────────────────────────────
const state = {
    isGenerating:   false,
    view:           'code',      // 'code' | 'preview'
    streamStatus:   'idle',      // 'idle' | 'streaming' | 'retrying' | 'done' | 'error'
    errorMessage:   null,
    generatedHTML:  null,
    rawCode:        '',
    charCount:      0,
    iframeSrcdocSet: false,
};

// ── Rendered-line bookkeeping (for incremental DOM append) ──────────────
let renderedLineCount = 0;

// ── State-Driven Render ─────────────────────────────────────────────────

/**
 * Single function that reconciles the entire UI from `state`.
 * Every user action or stream callback mutates state, then calls render().
 */
function render() {
    // ── Generate button ─────────────────────────────────────────────────
    setLoading(btnGenerate, btnGenText, btnSpinner, state.isGenerating);

    // ── Error display ───────────────────────────────────────────────────
    if (state.errorMessage) {
        showError(errorMessage, errorText, state.errorMessage);
    } else {
        hideError(errorMessage);
    }

    // ── Download button ─────────────────────────────────────────────────
    btnDownload.style.display = (state.generatedHTML && !state.isGenerating) ? 'flex' : 'none';

    // ── Stats bar ───────────────────────────────────────────────────────
    statsChars.textContent = state.charCount.toLocaleString() + ' chars';

    switch (state.streamStatus) {
        case 'streaming':
            statsDot.className  = 'preview-stats__dot preview-stats__dot--streaming';
            statsLabel.textContent = 'Streaming';
            break;
        case 'retrying':
            statsDot.className  = 'preview-stats__dot preview-stats__dot--streaming';
            statsLabel.textContent = 'Retrying…';
            break;
        case 'done':
            statsDot.className  = 'preview-stats__dot preview-stats__dot--done';
            statsLabel.textContent = 'Complete';
            break;
        case 'error':
            statsDot.className  = 'preview-stats__dot preview-stats__dot--error';
            statsLabel.textContent = 'Error';
            break;
        default: // 'idle'
            break;
    }

    // ── View tabs ───────────────────────────────────────────────────────
    tabCode.classList.toggle('preview-tab--active', state.view === 'code');
    tabPreview.classList.toggle('preview-tab--active', state.view === 'preview');

    // ── Panels ──────────────────────────────────────────────────────────
    if (state.streamStatus === 'idle') {
        // Nothing generated yet — show placeholder
        previewPlaceholder.style.display = 'flex';
        previewToolbar.style.display     = 'none';
        liveCodeView.style.display       = 'none';
        previewIframe.style.display      = 'none';
    } else if (state.view === 'code') {
        previewPlaceholder.style.display = 'none';
        previewToolbar.style.display     = 'flex';
        liveCodeView.style.display       = 'block';
        previewIframe.style.display      = 'none';
    } else {
        // 'preview'
        previewPlaceholder.style.display = 'none';
        previewToolbar.style.display     = 'flex';
        liveCodeView.style.display       = 'none';

        if (state.generatedHTML) {
            previewIframe.style.display = 'block';

            if (!state.iframeSrcdocSet) {
                previewIframe.srcdoc = state.generatedHTML;
                state.iframeSrcdocSet = true;
                previewIframe.onload = function () {
                    try {
                        const h = previewIframe.contentDocument.documentElement.scrollHeight;
                        previewIframe.style.height = Math.max(h, 500) + 'px';
                    } catch (_) {
                        previewIframe.style.height = '700px';
                    }
                };
            }
        } else {
            // No HTML generated yet — show placeholder, not blank iframe
            previewIframe.style.display      = 'none';
            previewPlaceholder.style.display = 'flex';
        }
    }
}

// ── Code-Line Renderer (Bulletproof DOM Insertion) ───────────────────────

/**
 * Render code lines incrementally — only adds new/changed lines.
 * Uses programmatic DOM construction + textContent (100% XSS-proof).
 */
function renderCodeLines(code) {
    const lines = code.split('\n');
    const totalLines = lines.length;

    // Update the last rendered line (may have been a partial line from previous chunk)
    if (renderedLineCount > 0 && renderedLineCount <= totalLines) {
        const lastLineEl = liveCodeOutput.children[renderedLineCount - 1];
        if (lastLineEl) {
            const textEl = lastLineEl.querySelector('.code-line__text');
            if (textEl) {
                textEl.textContent = lines[renderedLineCount - 1];
            }
        }
    }

    // Append new lines
    const fragment = document.createDocumentFragment();
    for (let i = renderedLineCount; i < totalLines; i++) {
        const lineEl = document.createElement('div');
        lineEl.className = 'code-line';

        const numSpan = document.createElement('span');
        numSpan.className = 'code-line__num';
        numSpan.textContent = String(i + 1);

        const textSpan = document.createElement('span');
        textSpan.className = 'code-line__text';
        textSpan.textContent = lines[i];

        lineEl.append(numSpan, textSpan);
        fragment.appendChild(lineEl);
    }

    if (fragment.childNodes.length > 0) {
        liveCodeOutput.appendChild(fragment);
    }

    renderedLineCount = totalLines;
}

/**
 * Reset the live code view for a fresh generation (or retry).
 */
function resetCodeView() {
    liveCodeOutput.innerHTML = '';
    renderedLineCount = 0;
}

// ── Char Counter ────────────────────────────────────────────────────────

function updateCharCounter() {
    const len = promptInput.value.length;
    charCounter.textContent = len + ' / 500';
    charCounter.className = 'char-counter';
    if (len > 450) charCounter.classList.add('char-counter--warning');
    if (len > 500) charCounter.classList.add('char-counter--error');
}

// ── Sample Loading ──────────────────────────────────────────────────────

function loadSample(type) {
    jsonInput.value   = SAMPLES[type] || '';
    promptInput.value = SAMPLE_PROMPTS[type] || '';
    updateCharCounter();
    state.errorMessage = null;
    render();
    promptInput.focus();
}

function clearInputs() {
    jsonInput.value   = '';
    promptInput.value = '';
    updateCharCounter();
    state.errorMessage = null;
    render();
}

// ── Download ────────────────────────────────────────────────────────────

function handleDownload() {
    if (!state.generatedHTML) return;

    const blob = new Blob([state.generatedHTML], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'dashboard.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Main Submission Handler ─────────────────────────────────────────────

async function handleSubmit() {
    // Clear previous error
    state.errorMessage = null;
    render();

    const jsonStr = jsonInput.value.trim();
    const prompt  = promptInput.value.trim();

    // Client-side validation
    if (!jsonStr) {
        state.errorMessage = 'Please paste your JSON data.';
        render();
        jsonInput.focus();
        return;
    }

    const jsonCheck = validateJSON(jsonStr);
    if (!jsonCheck.valid) {
        state.errorMessage = jsonCheck.error;
        render();
        jsonInput.focus();
        return;
    }

    if (!prompt) {
        state.errorMessage = 'Please enter a design prompt.';
        render();
        promptInput.focus();
        return;
    }

    if (prompt.length > 500) {
        state.errorMessage = 'Design prompt exceeds 500 characters.';
        render();
        promptInput.focus();
        return;
    }

    // Transition to generating state
    state.isGenerating   = true;
    state.streamStatus   = 'streaming';
    state.generatedHTML  = null;
    state.iframeSrcdocSet = false;
    state.rawCode        = '';
    state.charCount      = 0;
    state.view           = 'code';
    state.errorMessage   = null;
    resetCodeView();
    render();

    await client.stream(
        { json_data: jsonStr, user_prompt: prompt },
        {
            onChunk(chunk) {
                state.rawCode += chunk;
                state.charCount = state.rawCode.length;
                renderCodeLines(state.rawCode);

                // Update char count in stats (render() would work but this is a hot path)
                statsChars.textContent = state.charCount.toLocaleString() + ' chars';

                // Auto-scroll code view to the bottom
                requestAnimationFrame(() => {
                    liveCodeView.scrollTop = liveCodeView.scrollHeight;
                });
            },

            onRetry(_parsed) {
                // Server is retrying — reset live view
                state.rawCode     = '';
                state.charCount   = 0;
                state.streamStatus = 'retrying';
                resetCodeView();
                render();
            },

            onDone(html) {
                state.generatedHTML = html;
                state.isGenerating  = false;
                state.streamStatus  = 'done';
                render();

                // Auto-switch to preview after a brief moment
                setTimeout(() => {
                    state.view = 'preview';
                    render();
                }, 800);
            },

            onError(msg) {
                state.errorMessage  = msg;
                state.isGenerating  = false;
                state.streamStatus  = 'error';
                render();
            },
        }
    );

    // If stream ended without triggering onDone or onError (shouldn't happen,
    // but StreamClient already calls onError for this case), ensure we're not stuck.
    if (state.isGenerating) {
        state.isGenerating = false;
        state.streamStatus = 'error';
        if (!state.errorMessage) {
            state.errorMessage = 'Stream ended unexpectedly. Please try again.';
        }
        render();
    }
}

// ── Event Listeners ─────────────────────────────────────────────────────
promptInput.addEventListener('input', updateCharCounter);
btnGenerate.addEventListener('click', handleSubmit);
btnDownload.addEventListener('click', handleDownload);

document.getElementById('btn-sample-sales').addEventListener('click', () => loadSample('sales'));
document.getElementById('btn-sample-analytics').addEventListener('click', () => loadSample('analytics'));
document.getElementById('btn-sample-hr').addEventListener('click', () => loadSample('hr'));
document.getElementById('btn-sample-clear').addEventListener('click', clearInputs);

tabCode.addEventListener('click', () => {
    state.view = 'code';
    render();
});

tabPreview.addEventListener('click', () => {
    state.view = 'preview';
    render();
});

// ── Initialize ──────────────────────────────────────────────────────────
updateCharCounter();
