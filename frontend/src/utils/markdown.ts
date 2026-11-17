/**
 * Renim AI — Lightweight In-Memory Markdown Renderer
 * Parses headings, bullet lists, numbered lists, blockquotes, code blocks and inline styles.
 */

export function renderMarkdownToHtml(md: string): string {
  if (!md) return '';

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Extract fenced code blocks first
  const codeBlocks: string[] = [];
  const textWithPlaceholders = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `@@CODEBLOCK_${idx}@@`;
  });

  const formatInline = (line: string) => {
    let out = escapeHtml(line);
    // Inline code
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold **text**
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    return out;
  };

  const lines = textWithPlaceholders.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      htmlParts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      htmlParts.push('</ol>');
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^@@CODEBLOCK_\d+@@$/.test(trimmed)) {
      closeLists();
      const idx = parseInt(trimmed.replace(/\D/g, ''), 10);
      htmlParts.push(codeBlocks[idx] || '');
      continue;
    }

    if (!trimmed) {
      closeLists();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeLists();
      htmlParts.push('<hr/>');
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) {
        htmlParts.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        htmlParts.push('<ul>');
        inUl = true;
      }
      htmlParts.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) {
        htmlParts.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        htmlParts.push('<ol>');
        inOl = true;
      }
      htmlParts.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    closeLists();
    htmlParts.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeLists();
  return htmlParts.join('');
}
