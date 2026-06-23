/**
 * Simple markdown-to-HTML converter for chat messages
 * Handles common markdown patterns used by Amara
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Convert bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Convert italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Convert headers (### Header)
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-serif font-semibold mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-serif font-semibold mt-4 mb-2">$1</h1>');

  // Convert horizontal rules (---)
  html = html.replace(/^---$/gm, '<hr class="my-4 border-futurex-line" />');

  // Convert bullet lists (- item or * item)
  html = html.replace(/^[*-] (.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-1 my-2">$&</ul>');

  // Convert numbered lists (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>');

  // Convert line breaks to <br> for better spacing
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\n/g, '<br/>');

  // Convert checkmarks and icons
  html = html.replace(/✅/g, '<span class="text-green-500">✅</span>');
  html = html.replace(/🔹/g, '<span class="text-futurex-gold">🔹</span>');
  html = html.replace(/🌟/g, '<span class="text-futurex-gold">🌟</span>');

  return html;
}

/**
 * Strip markdown formatting for plain text display
 */
export function stripMarkdown(markdown: string): string {
  let text = markdown;

  // Remove bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');

  // Remove italic
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // Remove headers
  text = text.replace(/^#{1,6} (.+)$/gm, '$1');

  // Remove horizontal rules
  text = text.replace(/^---$/gm, '');

  // Convert bullet lists to plain text
  text = text.replace(/^[*-] /gm, '• ');

  return text.trim();
}
