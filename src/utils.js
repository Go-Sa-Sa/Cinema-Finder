// ==========================================================================
// HTML Escape & URL Sanitize Helpers
// ==========================================================================

const HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
};

// スクレイピングで取得した文字列を innerHTML に埋め込む前にエスケープする
export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

// http(s) 以外のURL（javascript: など）は空文字にする
export function safeUrl(url) {
    const str = String(url ?? "").trim();
    return /^https?:\/\//i.test(str) ? str : "";
}
