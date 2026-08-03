/**
 * Clean-room HTML sanitiser for WordPress-originated content.
 *
 * Everything arriving from the exports is treated as untrusted text. We parse it
 * with regexes into a token stream and re-emit only an allowlisted subset of
 * tags and attributes, so no script, style, iframe, event handler, inline style
 * or Elementor/plugin markup can survive into the Astro build.
 */

const ALLOWED_TAGS = new Set([
  'h2', 'h3', 'h4', 'h5', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'a', 'br',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'sup', 'sub',
]);

/** Tags whose entire contents are dropped, not just the tag itself. */
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|form|svg|canvas|template|link|meta)\b[^>]*>[\s\S]*?<\/\1>/gi;
const DROP_VOID = /<(script|style|iframe|object|embed|link|meta|input|source|param|base)\b[^>]*\/?>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/** Hosts injected by the malware. Any link to these is deleted outright. */
export const SPAM_HOSTS = new Set([
  'betwin360casino.it', 'roman-peschanoe.ru', 'madslotscasinos.com', 'casinosbof.co.uk',
  'casino-verywell.co.uk', 'capitancooks.co.uk', 'chickenroadsgioco.it',
  'melhorcasinoonlineportugal.com', 'boaboa.pt', 'botteganapule.com', 'crobar.co.uk',
  'cmgv.es', 'montecatini.cl', 'sanodelucas.cl', 'papeleriaeliris.com.mx',
]);

/** Unrelated brands whose links must never appear on Inserts Hub. */
export const CROSS_SITE_HOSTS = new Set(['thecandlepackaging.com', 'www.thecandlepackaging.com']);

/** Legitimate off-site destinations we keep. */
export const ALLOWED_EXTERNAL_HOSTS = new Set([
  'www.facebook.com', 'facebook.com', 'www.linkedin.com', 'linkedin.com',
]);

const ORIGIN_RE = /^https?:\/\/(?:www\.)?insertshub\.com/i;

export function toSitePath(href) {
  let u = (href || '').trim();
  if (ORIGIN_RE.test(u)) u = u.replace(ORIGIN_RE, '') || '/';
  return u;
}

export function hostOf(href) {
  const m = /^https?:\/\/([^/?#]+)/i.exec(href || '');
  return m ? m[1].toLowerCase() : '';
}

/**
 * WordPress `wpautop`: bare text separated by blank lines becomes paragraphs,
 * single newlines inside a paragraph become spaces. Block-level markup is left
 * alone. Woo's CSV export encodes newlines as the literal characters `\` + `n`.
 */
const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'table', 'thead',
  'tbody', 'tfoot', 'tr', 'th', 'td', 'div', 'blockquote', 'section', 'figure', 'pre', 'article', 'main']);

/** Inside these, bare text already occupies a paragraph-equivalent slot — never re-wrap it. */
const TEXT_CONTAINERS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'th', 'td',
  'blockquote', 'pre', 'figcaption']);

export function wpautop(input) {
  const s = String(input || '')
    .replace(/\\r\\n|\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ');

  const out = [];
  const stack = [];
  let run = '';

  /** Close off the current run of top-level text + inline markup as paragraphs. */
  const flush = () => {
    const pending = run;
    run = '';
    if (!pending.replace(/<[^>]+>/g, '').trim()) return;
    const inner = stack[stack.length - 1];
    if (inner && TEXT_CONTAINERS.has(inner)) { out.push(pending); return; }
    for (const chunk of pending.split(/\n{2,}/)) {
      const t = chunk.trim();
      if (t) out.push(`<p>${t.replace(/\n/g, ' ')}</p>\n`);
    }
  };

  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let last = 0;
  let m;
  while ((m = tagRe.exec(s))) {
    run += s.slice(last, m.index);
    const tag = m[1].toLowerCase();
    const closing = m[0].startsWith('</');
    const voidish = /\/>$/.test(m[0]) || tag === 'br' || tag === 'hr' || tag === 'img';
    if (BLOCK_TAGS.has(tag)) {
      flush();
      out.push(m[0]);
      if (!voidish) {
        if (closing) {
          const i = stack.lastIndexOf(tag);
          if (i >= 0) stack.splice(i);
        } else stack.push(tag);
      }
    } else {
      run += m[0];
    }
    last = m.index + m[0].length;
  }
  run += s.slice(last);
  flush();
  return out.join('');
}

/**
 * Re-emit `html` keeping only allowlisted tags. `linkPolicy(href)` returns
 * `{ action: 'keep'|'unwrap'|'drop', href }` — `unwrap` keeps the anchor text
 * but removes the link, `drop` deletes text and all.
 */
export function sanitizeHtml(html, { linkPolicy = () => ({ action: 'keep' }) } = {}) {
  let s = String(html || '');
  s = s.replace(HTML_COMMENT, '');
  s = s.replace(DROP_WITH_CONTENT, '');
  s = s.replace(DROP_VOID, '');

  // Resolve anchors first so the policy sees the original href.
  s = s.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs, inner) => {
    const href = decodeEntities(getAttr(attrs, 'href') || '');
    const policy = linkPolicy(href) || { action: 'keep' };
    if (policy.action === 'drop') return '';
    if (policy.action === 'unwrap') return inner;
    const finalHref = policy.href || href;
    const host = hostOf(finalHref);
    const rel = host && !ORIGIN_RE.test(finalHref) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeAttr(finalHref)}"${rel}>${inner}</a>`;
  });

  // Now strip every other tag down to the allowlist, dropping all attributes.
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (m, tagRaw, attrs) => {
    const tag = tagRaw.toLowerCase();
    if (tag === 'a') return m; // already normalised above
    if (!ALLOWED_TAGS.has(tag)) return '';
    const closing = m.startsWith('</');
    if (closing) return `</${tag}>`;
    if (tag === 'br') return '<br />';
    return `<${tag}>`;
  });

  s = s.replace(/<p>\s*<\/p>/g, '');
  s = s.replace(/<h([2-5])>\s*<\/h\1>/g, '');
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function getAttr(attrs, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs) ||
            new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i').exec(attrs);
  return m ? m[1] : '';
}

export function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function decodeEntities(s) {
  return String(s || '')
    .replace(/&#0?38;|&amp;/g, '&').replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘').replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”').replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—').replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)));
}

export function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
