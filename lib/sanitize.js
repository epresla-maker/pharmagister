// lib/sanitize.js

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate and sanitize a URL - only allow https: URLs
 */
export function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  // Only allow https URLs
  if (!trimmed.startsWith('https://')) {
    return '';
  }
  return trimmed;
}
