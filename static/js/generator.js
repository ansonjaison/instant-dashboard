/**
 * Instant Dashboard — Generator Page Logic
 * Handles form validation, SSE streaming, live code preview, and sample data.
 */

(function () {
    'use strict';

    // ── DOM Elements ──────────────────────────────────────────────────────
    const jsonInput = document.getElementById('json-input');
    const promptInput = document.getElementById('prompt-input');
    const charCounter = document.getElementById('char-counter');
    const btnGenerate = document.getElementById('btn-generate');
    const btnGenText = document.getElementById('btn-generate-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const btnDownload = document.getElementById('btn-download');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const previewToolbar = document.getElementById('preview-toolbar');
    const previewIframe = document.getElementById('preview-iframe');

    // Live code view elements
    const liveCodeView = document.getElementById('live-code-view');
    const liveCodeOutput = document.getElementById('live-code-output');

    // Tabs & stats
    const tabCode = document.getElementById('tab-code');
    const tabPreview = document.getElementById('tab-preview');
    const statsChars = document.getElementById('stats-chars');
    const statsDot = document.getElementById('stats-dot');
    const statsLabel = document.getElementById('stats-label');

    let generatedHTML = null;
    let currentView = 'code'; // 'code' or 'preview'

    // ── Sample Data ───────────────────────────────────────────────────────
    const SAMPLES = {
        sales: JSON.stringify({
            "company": "TechCorp Inc.",
            "quarter": "Q4 2025",
            "total_revenue": 1284500,
            "total_expenses": 892300,
            "net_profit": 392200,
            "profit_margin": "30.5%",
            "departments": [
                { "name": "Engineering", "revenue": 520000, "headcount": 45 },
                { "name": "Sales", "revenue": 480000, "headcount": 32 },
                { "name": "Marketing", "revenue": 184500, "headcount": 18 },
                { "name": "Operations", "revenue": 100000, "headcount": 12 }
            ],
            "monthly_revenue": [
                { "month": "October", "amount": 398000 },
                { "month": "November", "amount": 421500 },
                { "month": "December", "amount": 465000 }
            ],
            "top_products": [
                { "name": "Cloud Suite Pro", "sales": 342, "revenue": 513000 },
                { "name": "Data Analytics", "sales": 218, "revenue": 392400 },
                { "name": "Security Shield", "sales": 189, "revenue": 283500 }
            ]
        }, null, 2),

        analytics: JSON.stringify({
            "website": "dashboard.app",
            "period": "January 2026",
            "visitors": 48230,
            "unique_visitors": 31450,
            "page_views": 142800,
            "bounce_rate": "34.2%",
            "avg_session_duration": "4m 23s",
            "conversion_rate": "3.8%",
            "traffic_sources": [
                { "source": "Organic Search", "visitors": 18720, "percentage": "38.8%" },
                { "source": "Direct", "visitors": 12480, "percentage": "25.9%" },
                { "source": "Social Media", "visitors": 9640, "percentage": "20.0%" },
                { "source": "Referral", "visitors": 4820, "percentage": "10.0%" },
                { "source": "Email", "visitors": 2570, "percentage": "5.3%" }
            ],
            "top_pages": [
                { "page": "/home", "views": 42300, "avg_time": "2m 15s" },
                { "page": "/pricing", "views": 28400, "avg_time": "3m 42s" },
                { "page": "/features", "views": 21800, "avg_time": "2m 58s" },
                { "page": "/docs", "views": 18200, "avg_time": "5m 10s" }
            ],
            "devices": {
                "desktop": "58.3%",
                "mobile": "34.1%",
                "tablet": "7.6%"
            }
        }, null, 2),

        hr: JSON.stringify({
            "organization": "GlobalTech Solutions",
            "report_date": "February 2026",
            "total_employees": 284,
            "new_hires": 12,
            "attrition_rate": "4.2%",
            "avg_tenure": "3.4 years",
            "departments": [
                { "name": "Engineering", "count": 98, "avg_salary": 125000 },
                { "name": "Product", "count": 42, "avg_salary": 115000 },
                { "name": "Sales", "count": 56, "avg_salary": 95000 },
                { "name": "Marketing", "count": 34, "avg_salary": 88000 },
                { "name": "HR & Admin", "count": 28, "avg_salary": 78000 },
                { "name": "Finance", "count": 26, "avg_salary": 105000 }
            ],
            "satisfaction_score": 4.2,
            "diversity": {
                "gender": { "male": "56%", "female": "41%", "non_binary": "3%" },
                "remote_vs_office": { "remote": "62%", "hybrid": "28%", "office": "10%" }
            },
            "open_positions": 8
        }, null, 2)
    };

    // ── Event Listeners ───────────────────────────────────────────────────
    promptInput.addEventListener('input', updateCharCounter);
    btnGenerate.addEventListener('click', handleSubmit);
    btnDownload.addEventListener('click', handleDownload);

    document.getElementById('btn-sample-sales').addEventListener('click', () => loadSample('sales'));
    document.getElementById('btn-sample-analytics').addEventListener('click', () => loadSample('analytics'));
    document.getElementById('btn-sample-hr').addEventListener('click', () => loadSample('hr'));
    document.getElementById('btn-sample-clear').addEventListener('click', clearInputs);

    tabCode.addEventListener('click', () => switchView('code'));
    tabPreview.addEventListener('click', () => switchView('preview'));

    // ── Functions ─────────────────────────────────────────────────────────

    function updateCharCounter() {
        const len = promptInput.value.length;
        charCounter.textContent = len + ' / 500';
        charCounter.className = 'char-counter';
        if (len > 450) charCounter.classList.add('char-counter--warning');
        if (len > 500) charCounter.classList.add('char-counter--error');
    }

    function loadSample(type) {
        jsonInput.value = SAMPLES[type] || '';
        jsonInput.focus();
    }

    function clearInputs() {
        jsonInput.value = '';
        promptInput.value = '';
        updateCharCounter();
        hideError();
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorMessage.classList.add('error-message--visible');
    }

    function hideError() {
        errorMessage.classList.remove('error-message--visible');
    }

    function setLoading(state) {
        if (state) {
            btnGenerate.disabled = true;
            btnGenText.textContent = 'Generating…';
            btnSpinner.style.display = 'block';
        } else {
            btnGenerate.disabled = false;
            btnGenText.textContent = 'Generate Dashboard';
            btnSpinner.style.display = 'none';
        }
    }

    function validateJSON(str) {
        try {
            JSON.parse(str);
            return { valid: true };
        } catch (e) {
            return { valid: false, error: 'Invalid JSON: ' + e.message };
        }
    }

    /**
     * Switch between Code and Preview views
     */
    let iframeSrcdocSet = false; // Track whether srcdoc has been set for current generation

    function switchView(view) {
        currentView = view;

        if (view === 'code') {
            tabCode.classList.add('preview-tab--active');
            tabPreview.classList.remove('preview-tab--active');
            liveCodeView.style.display = 'block';
            previewIframe.style.display = 'none';
        } else {
            tabPreview.classList.add('preview-tab--active');
            tabCode.classList.remove('preview-tab--active');
            liveCodeView.style.display = 'none';

            if (generatedHTML) {
                // Show iframe first (browsers won't load srcdoc on display:none)
                previewIframe.style.display = 'block';

                // Only set srcdoc if it hasn't been set for this generation,
                // to avoid re-loading and flashing white on tab switches.
                if (!iframeSrcdocSet) {
                    previewIframe.srcdoc = generatedHTML;
                    iframeSrcdocSet = true;
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
                previewIframe.style.display = 'none';
                previewPlaceholder.style.display = 'flex';
            }
        }
    }

    /**
     * Escape HTML characters for safe rendering inside innerHTML
     */
    function escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Render code lines incrementally — only adds new/changed lines.
     * Each line is a single self-contained element with its own number.
     */
    let renderedLineCount = 0;

    function renderCodeLines(code) {
        const lines = code.split('\n');
        const totalLines = lines.length;

        // Update the last rendered line (it may have been a partial line from previous chunk)
        if (renderedLineCount > 0 && renderedLineCount <= totalLines) {
            const lastLineEl = liveCodeOutput.children[renderedLineCount - 1];
            if (lastLineEl) {
                const textEl = lastLineEl.querySelector('.code-line__text');
                if (textEl) {
                    textEl.innerHTML = escapeHTML(lines[renderedLineCount - 1]);
                }
            }
        }

        // Append new lines
        const fragment = document.createDocumentFragment();
        for (let i = renderedLineCount; i < totalLines; i++) {
            const lineEl = document.createElement('div');
            lineEl.className = 'code-line';
            lineEl.innerHTML =
                '<span class="code-line__num">' + (i + 1) + '</span>' +
                '<span class="code-line__text">' + escapeHTML(lines[i]) + '</span>';
            fragment.appendChild(lineEl);
        }

        if (fragment.childNodes.length > 0) {
            liveCodeOutput.appendChild(fragment);
        }

        renderedLineCount = totalLines;
    }

    /**
     * Show the live code panel and hide placeholder
     */
    function showLiveCodeView() {
        previewPlaceholder.style.display = 'none';
        previewToolbar.style.display = 'flex';
        liveCodeView.style.display = 'block';
        previewIframe.style.display = 'none';
        liveCodeOutput.innerHTML = '';
        renderedLineCount = 0;

        // Reset to code tab
        tabCode.classList.add('preview-tab--active');
        tabPreview.classList.remove('preview-tab--active');
        currentView = 'code';

        // Streaming status
        statsDot.className = 'preview-stats__dot preview-stats__dot--streaming';
        statsLabel.textContent = 'Streaming';
        statsChars.textContent = '0 chars';
    }

    /**
     * Set the status to 'done' in the toolbar
     */
    function setStreamDone() {
        statsDot.className = 'preview-stats__dot preview-stats__dot--done';
        statsLabel.textContent = 'Complete';
    }

    /**
     * Set the status to 'error' in the toolbar
     */
    function setStreamError() {
        statsDot.className = 'preview-stats__dot preview-stats__dot--error';
        statsLabel.textContent = 'Error';
    }

    // renderIframe is no longer used during streaming.
    // The iframe is rendered when the user switches to Preview view
    // (or on auto-switch) ensuring the iframe is visible first.

    /**
     * Main submission handler — uses SSE streaming
     */
    async function handleSubmit() {
        hideError();

        const jsonStr = jsonInput.value.trim();
        const prompt = promptInput.value.trim();

        // Client-side validation
        if (!jsonStr) {
            showError('Please paste your JSON data.');
            jsonInput.focus();
            return;
        }

        const jsonCheck = validateJSON(jsonStr);
        if (!jsonCheck.valid) {
            showError(jsonCheck.error);
            jsonInput.focus();
            return;
        }

        if (!prompt) {
            showError('Please enter a design prompt.');
            promptInput.focus();
            return;
        }

        if (prompt.length > 500) {
            showError('Design prompt exceeds 500 characters.');
            promptInput.focus();
            return;
        }

        setLoading(true);
        showLiveCodeView();
        btnDownload.style.display = 'none';
        generatedHTML = null;
        iframeSrcdocSet = false; // Reset so new generation HTML gets loaded into iframe

        let rawStreamedCode = '';

        try {
            const response = await fetch('/api/generate-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    json_data: jsonStr,
                    user_prompt: prompt
                })
            });

            if (!response.ok) {
                // Non-SSE error (validation fail, etc.)
                const errorData = await response.json();
                showError(errorData.error || 'Generation failed. Please try again.');
                setLoading(false);
                setStreamError();
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE events (double newline separated)
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
                            // Error event from server
                            showError(parsed.error || 'Generation failed.');
                            setStreamError();
                            setLoading(false);
                            return;
                        }

                        if (eventType === 'done') {
                            // Stream completed — we have the final sanitized HTML
                            generatedHTML = parsed.html;
                            setStreamDone();
                            btnDownload.style.display = 'flex';
                            setLoading(false);

                            // Auto-switch to preview after a brief moment
                            // switchView will handle rendering the iframe
                            setTimeout(() => switchView('preview'), 800);
                            return;
                        }

                        // Default data event (chunk)
                        if (parsed.chunk) {
                            rawStreamedCode += parsed.chunk;
                            renderCodeLines(rawStreamedCode);
                            statsChars.textContent = rawStreamedCode.length.toLocaleString() + ' chars';

                            // Auto-scroll code view to the bottom
                            requestAnimationFrame(() => {
                                liveCodeView.scrollTop = liveCodeView.scrollHeight;
                            });
                        }
                    } catch (parseErr) {
                        console.warn('Failed to parse SSE data:', parseErr);
                    }
                }
            }

            // If we exit the loop without a 'done' event, something went wrong
            if (!generatedHTML) {
                showError('Stream ended unexpectedly. Please try again.');
                setStreamError();
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                showError('Request timed out. Please try again.');
            } else {
                showError('Network error. Please check your connection and try again.');
            }
            console.error('Generate error:', err);
            setStreamError();
        } finally {
            setLoading(false);
        }
    }

    function handleDownload() {
        if (!generatedHTML) return;

        const blob = new Blob([generatedHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dashboard.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Initialize
    updateCharCounter();

})();
