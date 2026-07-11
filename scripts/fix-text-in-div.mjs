#!/usr/bin/env node
/**
 * Repair documents damaged by the Paste Special "Paragraphs" bug, which
 * inserted pasted paragraphs as bare TEI <div>text</div> instead of <p>.
 * TEI <div> cannot contain text or phrase-level elements, so those divs
 * fail validation and block auto-tagging ("Schema does not allow <persName>
 * inside <div>").
 *
 * For every <div> with direct non-whitespace text (or stray inline children
 * such as <persName>, <lb/>, <date>), consecutive runs of that content are
 * wrapped in a new <p>. Proper block children (<p>, nested <div>, <head>, …)
 * are left untouched.
 *
 * Usage:
 *   node scripts/fix-text-in-div.mjs [--dry-run] <file-or-directory>...
 *
 * Directories are scanned recursively for *.xml. Files are rewritten in
 * place only when something changed; --dry-run just reports.
 */

import fs from 'fs/promises';
import path from 'path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** Inline (phrase-level) tags that may appear in pasted paragraph content. */
const INLINE_TAGS = new Set([
  'lb',
  'persName',
  'placeName',
  'orgName',
  'org',
  'geogName',
  'name',
  'roleName',
  'rs',
  'title',
  'date',
  'hi',
  'seg',
  'foreign',
  'num',
  'ref',
  'term',
]);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targets = args.filter((arg) => arg !== '--dry-run');

if (targets.length === 0) {
  console.error('Usage: node scripts/fix-text-in-div.mjs [--dry-run] <file-or-directory>...');
  process.exit(1);
}

async function collectXmlFiles(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return target.endsWith('.xml') ? [target] : [];
  if (!stat.isDirectory()) return [];
  const entries = await fs.readdir(target, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== 'node_modules' && !entry.name.startsWith('.'))
      .map((entry) => collectXmlFiles(path.join(target, entry.name))),
  );
  return nested.flat();
}

const isWrappable = (node) => {
  if (node.nodeType === TEXT_NODE) return /\S/.test(node.data);
  if (node.nodeType === ELEMENT_NODE) return INLINE_TAGS.has(node.localName);
  return false;
};

const isWhitespaceText = (node) => node.nodeType === TEXT_NODE && !/\S/.test(node.data);

/** Wrap runs of text/inline children of `div` in <p>. Returns wraps made. */
function wrapStrayContentInDiv(doc, div) {
  const children = Array.from(div.childNodes);
  const runs = [];
  let run = null;

  for (const child of children) {
    if (isWrappable(child)) {
      if (!run) {
        run = [];
        runs.push(run);
      }
      run.push(child);
    } else if (run && isWhitespaceText(child)) {
      // Whitespace between wrappable nodes stays inside the paragraph;
      // trailing whitespace is trimmed off the run afterwards.
      run.push(child);
    } else {
      run = null;
    }
  }

  for (const nodes of runs) {
    while (nodes.length > 0 && isWhitespaceText(nodes[nodes.length - 1])) nodes.pop();
  }
  const effective = runs.filter((nodes) => nodes.length > 0);

  for (const nodes of effective) {
    const p = doc.createElementNS(div.namespaceURI, 'p');
    div.insertBefore(p, nodes[0]);
    for (const node of nodes) p.appendChild(node);
  }
  return effective.length;
}

async function fixFile(file) {
  const source = await fs.readFile(file, 'utf-8');
  const doc = new DOMParser({ onError: () => {} }).parseFromString(source, 'application/xml');
  if (!doc.documentElement) {
    console.warn(`SKIP (parse error): ${file}`);
    return 0;
  }

  const divs = Array.from(doc.getElementsByTagName('div'));
  let wraps = 0;
  for (const div of divs) {
    wraps += wrapStrayContentInDiv(doc, div);
  }
  if (wraps === 0) return 0;

  if (!dryRun) {
    await fs.writeFile(file, new XMLSerializer().serializeToString(doc), 'utf-8');
  }
  console.log(`${dryRun ? 'WOULD FIX' : 'FIXED'}: ${file} (${wraps} paragraph(s) wrapped)`);
  return wraps;
}

let totalWraps = 0;
let totalFiles = 0;
for (const target of targets) {
  for (const file of await collectXmlFiles(target)) {
    const wraps = await fixFile(file);
    if (wraps > 0) {
      totalWraps += wraps;
      totalFiles += 1;
    }
  }
}

console.log(
  `${dryRun ? '[dry-run] ' : ''}${totalWraps} paragraph(s) wrapped across ${totalFiles} file(s).`,
);
