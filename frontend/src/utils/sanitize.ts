/**
 * Renim AI — allowlist HTML sanitizer for rich-text note content.
 *
 * Note HTML is user-controlled and shared between org members, so it must never be inserted into the
 * DOM unsanitized (stored XSS → session-token theft). Anything not explicitly allowed is dropped.
 */

const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'a', 'img', 'font', 'input', 'label',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['class', 'style', 'title', 'align', 'colspan', 'rowspan', 'data-checked']),
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
  font: new Set(['color', 'size', 'face']),
  input: new Set(['type', 'checked', 'disabled']),
};

// Elements whose entire subtree is removed, not just unwrapped.
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math', 'form', 'textarea', 'select', 'button', 'link', 'meta', 'base']);

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/(?!\/))/i;
const SAFE_IMG = /^(https?:|data:image\/(png|jpe?g|gif|webp);base64,|blob:)/i;
const UNSAFE_STYLE = /(expression\s*\(|url\s*\(|javascript:|behavior\s*:|-moz-binding)/i;

function cleanNode(node: Node, doc: Document): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();

    if (DROP_WITH_CONTENT.has(tag)) {
      el.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap unknown elements but keep their (sanitized) text/children.
      cleanNode(el, doc);
      const frag = doc.createDocumentFragment();
      while (el.firstChild) frag.appendChild(el.firstChild);
      el.replaceWith(frag);
      continue;
    }
    if (tag === 'input' && (el.getAttribute('type') || '').toLowerCase() !== 'checkbox') {
      el.remove();
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const allowed = ALLOWED_ATTRS['*'].has(name) || (ALLOWED_ATTRS[tag]?.has(name) ?? false);
      const value = attr.value.trim();
      if (!allowed || name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (name === 'href' && !SAFE_URL.test(value)) {
        el.removeAttribute(attr.name);
      } else if (name === 'src' && !SAFE_IMG.test(value)) {
        el.removeAttribute(attr.name);
      } else if (name === 'style' && UNSAFE_STYLE.test(value)) {
        el.removeAttribute(attr.name);
      }
    }
    if (tag === 'a') {
      el.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    cleanNode(el, doc);
  }
}

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  if (typeof DOMParser === 'undefined') {
    // SSR / non-browser: fall back to plain escaped text.
    return dirty.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const doc = new DOMParser().parseFromString(`<body>${dirty}</body>`, 'text/html');
  cleanNode(doc.body, doc);
  return doc.body.innerHTML;
}
