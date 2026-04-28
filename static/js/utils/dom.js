/**
 * DOM utility functions.
 *
 * All functions receive their DOM targets as arguments — no module-level
 * queries — so they stay testable and reusable.
 */

/**
 * Display an error message.
 * @param {HTMLElement} containerEl  – the `.error-message` wrapper
 * @param {HTMLElement} textEl       – the `#error-text` span
 * @param {string}      msg         – message to display
 */
export function showError(containerEl, textEl, msg) {
    textEl.textContent = msg;
    containerEl.classList.add('error-message--visible');
}

/**
 * Hide the error message.
 * @param {HTMLElement} containerEl – the `.error-message` wrapper
 */
export function hideError(containerEl) {
    containerEl.classList.remove('error-message--visible');
}

/**
 * Toggle the generate button between loading / idle states.
 * @param {HTMLButtonElement} btnEl      – the button element
 * @param {HTMLElement}       textEl     – the button label span
 * @param {HTMLElement}       spinnerEl  – the spinner div inside the button
 * @param {boolean}           isLoading  – true = loading, false = idle
 */
export function setLoading(btnEl, textEl, spinnerEl, isLoading) {
    btnEl.disabled = isLoading;
    textEl.textContent = isLoading ? 'Generating…' : 'Generate Dashboard';
    spinnerEl.style.display = isLoading ? 'block' : 'none';
}

/**
 * Validate a raw JSON string.
 * @param   {string} str – JSON string to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateJSON(str) {
    try {
        JSON.parse(str);
        return { valid: true };
    } catch (e) {
        return { valid: false, error: 'Invalid JSON: ' + e.message };
    }
}
