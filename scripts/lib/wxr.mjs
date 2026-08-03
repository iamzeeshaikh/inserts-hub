/**
 * Minimal readers for the WordPress WXR export and the WooCommerce CSV export.
 * Both formats are consumed strictly as inert text — nothing is evaluated.
 */
import fs from 'node:fs';

const CDATA = /^<!\[CDATA\[([\s\S]*)\]\]>$/;

function unwrapCdata(s) {
  const m = CDATA.exec(s.trim());
  return m ? m[1] : s;
}

function tagText(block, tag) {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(block);
  return m ? unwrapCdata(m[1]) : '';
}

export function readWxr(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml))) {
    const b = m[1];
    const meta = {};
    const metaRe = /<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/g;
    let mm;
    while ((mm = metaRe.exec(b))) {
      meta[tagText(mm[1], 'wp:meta_key')] = tagText(mm[1], 'wp:meta_value');
    }
    const categories = [];
    const catRe = /<category domain="([^"]+)" nicename="([^"]+)"><!\[CDATA\[([\s\S]*?)\]\]><\/category>/g;
    let cm;
    while ((cm = catRe.exec(b))) categories.push({ domain: cm[1], slug: cm[2], name: cm[3] });

    items.push({
      id: tagText(b, 'wp:post_id'),
      type: tagText(b, 'wp:post_type'),
      status: tagText(b, 'wp:status'),
      slug: tagText(b, 'wp:post_name'),
      title: tagText(b, 'title'),
      link: tagText(b, 'link'),
      date: tagText(b, 'wp:post_date'),
      parent: tagText(b, 'wp:post_parent'),
      menuOrder: tagText(b, 'wp:menu_order'),
      attachmentUrl: tagText(b, 'wp:attachment_url'),
      excerpt: tagText(b, 'excerpt:encoded'),
      content: tagText(b, 'content:encoded'),
      categories,
      meta,
    });
  }
  return items;
}

/** RFC 4180 CSV reader. Handles quoted fields, embedded commas and newlines. */
export function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export function writeCsv(file, rows, columns) {
  const cols = columns || Object.keys(rows[0] || {});
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  fs.writeFileSync(file, body + '\n');
  return rows.length;
}
