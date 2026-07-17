#!/usr/bin/env node
/**
 * Syncs public artwork and generated assets from the private visual_design repo.
 *
 * The private repo is the source of truth for:
 * - core artwork (icon, splash, tab icons)
 * - spoiler-protected reward artwork
 * - achievement definitions
 *
 * This script clones or updates a cached checkout of visual_design, mirrors the
 * used artwork into the public repo, and regenerates the encrypted / obfuscated
 * outputs that the app consumes at runtime.
 */

import { createCipheriv, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VISUAL_DESIGN_REPO =
  process.env.VISUAL_DESIGN_REPO ?? 'git@github.com:lejeanbaptiste/visual_design.git';
const VISUAL_DESIGN_ROOT =
  process.env.VISUAL_DESIGN_ROOT ?? path.join(ROOT, '.cache', 'visual_design');
const BRANDING_DIR = path.join(ROOT, 'apps/desktop/resources/branding');

const BRANDING_TARGETS = [
  ['icon.svg', 'apps/desktop/resources/branding/icon.svg'],
  ['icon.png', 'apps/desktop/resources/branding/icon.png'],
  ['tab_explorer.svg', 'apps/commons/src/icons/tab/tab_explorer.svg'],
  ['tab_explorer.dark.svg', 'apps/commons/src/icons/tab/tab_explorer.dark.svg'],
  ['tab_explorer.png', 'apps/commons/src/icons/tab/tab_explorer.png'],
  ['tab_explorer.dark.png', 'apps/commons/src/icons/tab/tab_explorer.dark.png'],
  ['tab_find.svg', 'apps/commons/src/icons/tab/tab_find.svg'],
  ['tab_find.dark.svg', 'apps/commons/src/icons/tab/tab_find.dark.svg'],
  ['tab_find.png', 'apps/commons/src/icons/tab/tab_find.png'],
  ['tab_find.dark.png', 'apps/commons/src/icons/tab/tab_find.dark.png'],
  ['tab_xpath.svg', 'apps/commons/src/icons/tab/tab_xpath.svg'],
  ['tab_xpath.dark.svg', 'apps/commons/src/icons/tab/tab_xpath.dark.svg'],
  ['tab_xpath.png', 'apps/commons/src/icons/tab/tab_xpath.png'],
  ['tab_xpath.dark.png', 'apps/commons/src/icons/tab/tab_xpath.dark.png'],
  ['tab_toc.svg', 'apps/commons/src/icons/tab/tab_toc.svg'],
  ['tab_toc.dark.svg', 'apps/commons/src/icons/tab/tab_toc.dark.svg'],
  ['tab_toc.png', 'apps/commons/src/icons/tab/tab_toc.png'],
  ['tab_toc.dark.png', 'apps/commons/src/icons/tab/tab_toc.dark.png'],
  ['tab_tree.svg', 'apps/commons/src/icons/tab/tab_tree.svg'],
  ['tab_tree.dark.svg', 'apps/commons/src/icons/tab/tab_tree.dark.svg'],
  ['tab_tree.png', 'apps/commons/src/icons/tab/tab_tree.png'],
  ['tab_tree.dark.png', 'apps/commons/src/icons/tab/tab_tree.dark.png'],
  ['splash.svg', 'apps/desktop/resources/branding/splash.svg'],
  ['splash_new.png', 'apps/desktop/resources/branding/splash_new.png'],
];

const CLEANUP_TARGETS = [
  'design/export-icon.mjs',
  'design/export-tab-icons.mjs',
  'design/icons',
  'design/disambiguate.svg',
  'design/icon.svg',
  'design/icon.png',
  'design/icon_192.png',
  'design/icon.pdf',
  'design/splash_base.png',
  'design/splash_base2.png',
  'design/splash.svg',
  'design/splash_new.png',
  'design/tab_explorer.svg',
  'design/tab_explorer.dark.svg',
  'design/tab_explorer.png',
  'design/tab_explorer.dark.png',
  'design/tab_find.svg',
  'design/tab_find.dark.svg',
  'design/tab_find.png',
  'design/tab_find.dark.png',
  'design/tab_xpath.svg',
  'design/tab_xpath.dark.svg',
  'design/tab_xpath.png',
  'design/tab_xpath.dark.png',
  'design/tab_toc.svg',
  'design/tab_toc.dark.svg',
  'design/tab_toc.png',
  'design/tab_toc.dark.png',
  'design/tab_tree.svg',
  'design/tab_tree.dark.svg',
  'design/tab_tree.png',
  'design/tab_tree.dark.png',
  'design/tab_entity.svg',
  'design/tab_entity.dark.svg',
  'design/tab_entity.png',
  'design/tab_entity.dark.png',
  'design/tab_icons.svg',
  'apps/commons/src/icons/tab/tab_entity.svg',
  'apps/commons/src/icons/tab/tab_entity.dark.svg',
  'apps/commons/src/icons/tab/tab_entity.png',
  'apps/commons/src/icons/tab/tab_entity.dark.png',
  'apps/desktop/resources/branding/icon.svg',
  'apps/desktop/resources/branding/icon.png',
  'apps/desktop/resources/branding/splash.svg',
  'apps/desktop/resources/branding/splash_new.png',
];

const SOURCE_REPO_ICON_DIR = path.join(VISUAL_DESIGN_ROOT, 'icons');
const SOURCE_REPO_SPLASH_DIR = path.join(VISUAL_DESIGN_ROOT, 'splash');
const SOURCE_REPO_REWARDS_DIR = path.join(VISUAL_DESIGN_ROOT, 'rewards');
const SOURCE_REPO_ACHIEVEMENTS_DIR = path.join(VISUAL_DESIGN_ROOT, 'achievements');

const KEY_FILE = path.join(VISUAL_DESIGN_ROOT, '.asset-key');
const OUT_BIN = path.join(ROOT, 'apps/desktop/resources/game-assets/assets.bin');
const OUT_KEY_MODULE = path.join(ROOT, 'apps/desktop/src/generated/gameAssetKey.ts');
const OUT_DEFINITIONS = path.join(ROOT, 'apps/commons/src/desktop/achievements/definitions.ts');

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const REWARD_MANIFEST = {
  'uniforms/1': 'uniforms1-transparent.png',
  'uniforms/2': 'uniforms2-transparent.png',
  'uniforms/3': 'uniforms3-transparent.png',
  'uniforms/4': 'uniforms4-transparent.png',
  'uniforms/5': 'uniforms5-transparent.png',
  'uniforms/6': 'uniforms6-transparent.png',
  'uniforms/7': 'uniforms7-transparent.png',
  // Rank-gated portrait backdrops: bg/<rank><letter>, rank 1-7 matching
  // RANK_NAMES. The pool available to a player is cumulative - see
  // backgroundPoolForRank in UniformAvatar.tsx.
  'bg/1a': 'bg_1a.png',
  'bg/1b': 'bg_1b.png',
  'bg/2a': 'bg_2a.png',
  'bg/2b': 'bg_2b.png',
  'bg/2c': 'bg_2c.png',
  'bg/2d': 'bg_2d.png',
  'bg/2e': 'bg_2e.png',
  'bg/3a': 'bg_3a.png',
  'bg/3b': 'bg_3b.png',
  'bg/3c': 'bg_3c.png',
  'bg/4a': 'bg_4a.png',
  'bg/4b': 'bg_4b.png',
  'bg/4c': 'bg_4c.png',
  'bg/5a': 'bg_5a.png',
  'bg/5b': 'bg_5b.png',
  'bg/5c': 'bg_5c.png',
  'bg/6a': 'bg_6a.png',
  'bg/6b': 'bg_6b.png',
  'bg/6c': 'bg_6c.png',
  'bg/6d': 'bg_6d.png',
  'bg/7a': 'bg_7a.png',
  'bg/7b': 'bg_7b.png',
};

const SALT_ASSETS = Buffer.from('leJeanBaptiste-game-assets-v1');
const SALT_DEFINITIONS = Buffer.from('leJeanBaptiste-achievement-definitions-v1');

function runGit(args) {
  execFileSync('git', ['-C', VISUAL_DESIGN_ROOT, ...args], { stdio: 'inherit' });
}

function ensureVisualDesignRepo() {
  if (!existsSync(path.join(VISUAL_DESIGN_ROOT, '.git'))) {
    mkdirSync(path.dirname(VISUAL_DESIGN_ROOT), { recursive: true });
    execFileSync('git', ['clone', '--depth', '1', VISUAL_DESIGN_REPO, VISUAL_DESIGN_ROOT], {
      stdio: 'inherit',
    });
    return;
  }

  runGit(['pull', '--ff-only', 'origin', 'main']);
}

function copyRelative(sourceBase, sourceRel, destinationRel) {
  const sourcePath = path.join(sourceBase, sourceRel);
  const destinationPath = path.join(ROOT, destinationRel);
  mkdirSync(path.dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath);
}

function removeIfPresent(relPath) {
  rmSync(path.join(ROOT, relPath), { force: true });
}

function syncArtwork() {
  for (const relPath of CLEANUP_TARGETS) removeIfPresent(relPath);

  for (const [sourceRel, destinationRel] of BRANDING_TARGETS) {
    const sourceBase = sourceRel.startsWith('splash') ? SOURCE_REPO_SPLASH_DIR : SOURCE_REPO_ICON_DIR;
    copyRelative(sourceBase, sourceRel, destinationRel);
  }
}

function loadOrCreateKey() {
  if (existsSync(KEY_FILE)) {
    const key = Buffer.from(readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
    if (key.length !== 32) throw new Error('.asset-key must decode to 32 bytes');
    return key;
  }

  const key = randomBytes(32);
  writeFileSync(KEY_FILE, key.toString('hex'), 'utf8');
  return key;
}

function obfuscate(bytes, salt) {
  return Buffer.from(bytes.map((byte, i) => byte ^ salt[i % salt.length]));
}

function packGameAssets() {
  const key = loadOrCreateKey();
  const index = {};
  const chunks = [];
  let offset = 0;

  for (const [assetKey, relPath] of Object.entries(REWARD_MANIFEST)) {
    const filePath = path.join(SOURCE_REPO_REWARDS_DIR, relPath);
    const buf = readFileSync(filePath);
    const ext = path.extname(relPath).toLowerCase();
    index[assetKey] = {
      offset,
      length: buf.length,
      type: CONTENT_TYPES[ext] ?? 'application/octet-stream',
    };
    chunks.push(buf);
    offset += buf.length;
  }

  const indexJson = Buffer.from(JSON.stringify(index), 'utf8');
  const indexLenPrefix = Buffer.alloc(4);
  indexLenPrefix.writeUInt32LE(indexJson.length, 0);
  const payload = Buffer.concat([indexLenPrefix, indexJson, ...chunks]);

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const out = Buffer.concat([iv, authTag, ciphertext]);

  mkdirSync(path.dirname(OUT_BIN), { recursive: true });
  writeFileSync(OUT_BIN, out);

  const obfuscatedHex = obfuscate(key, SALT_ASSETS).toString('hex');
  mkdirSync(path.dirname(OUT_KEY_MODULE), { recursive: true });
  writeFileSync(
    OUT_KEY_MODULE,
    `// Generated by scripts/sync-visual-design.mjs — do not edit by hand.
// Source of truth: visual_design/rewards/* (private repo).

const OBFUSCATED_KEY_HEX = '${obfuscatedHex}';
const SALT = ${JSON.stringify(Array.from(SALT_ASSETS))};

export function getGameAssetKey(): Buffer {
  const obfuscated = Buffer.from(OBFUSCATED_KEY_HEX, 'hex');
  return Buffer.from(obfuscated.map((byte, i) => byte ^ SALT[i % SALT.length]));
}
`,
    'utf8',
  );
}

function packAchievementDefinitions() {
  const sourcePath = path.join(SOURCE_REPO_ACHIEVEMENTS_DIR, 'definitions.ts');
  const source = readFileSync(sourcePath, 'utf8');
  const { code } = esbuild.transformSync(source, {
    loader: 'ts',
    format: 'cjs',
    target: 'es2020',
  });

  const obfuscated = obfuscate(Buffer.from(code, 'utf8'), SALT_DEFINITIONS).toString('base64');
  writeFileSync(
    OUT_DEFINITIONS,
    `// Generated by scripts/sync-visual-design.mjs — do not edit by hand.
// Source of truth: visual_design/achievements/definitions.ts (private repo).

import type { RankMedalDef, SpecialAchievementDef } from './types';

const OBFUSCATED = '${obfuscated}';
const SALT = ${JSON.stringify(Array.from(SALT_DEFINITIONS))};

function deobfuscate(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) out[i] = bytes[i] ^ SALT[i % SALT.length];
  return new TextDecoder().decode(out);
}

interface CompiledDefinitions {
  RANK_NAMES: readonly string[];
  RANK_MEDALS: RankMedalDef[];
  rankMedalAchievementId: (metric: string, rankIndex: number) => string;
  SPECIAL_ACHIEVEMENTS: SpecialAchievementDef[];
  RARE_ACHIEVEMENTS: SpecialAchievementDef[];
  RARE_UNLOCK_PROBABILITY: number;
  TOTAL_ACHIEVEMENTS: number;
  ANNOTATION_TAGS: Set<string>;
  DISAMBIGUATION_ATTRS: readonly string[];
  findAchievementDef: (id: string) => SpecialAchievementDef | null;
}

const moduleShell: { exports: Partial<CompiledDefinitions> } = { exports: {} };
// eslint-disable-next-line no-new-func -- de-obfuscated, self-contained, no external requires
new Function('module', 'exports', deobfuscate(OBFUSCATED))(moduleShell, moduleShell.exports);
const compiled = moduleShell.exports as CompiledDefinitions;

export const RANK_NAMES = compiled.RANK_NAMES;
export const RANK_MEDALS = compiled.RANK_MEDALS;
export const rankMedalAchievementId = compiled.rankMedalAchievementId;
export const SPECIAL_ACHIEVEMENTS = compiled.SPECIAL_ACHIEVEMENTS;
export const RARE_ACHIEVEMENTS = compiled.RARE_ACHIEVEMENTS;
export const RARE_UNLOCK_PROBABILITY = compiled.RARE_UNLOCK_PROBABILITY;
export const TOTAL_ACHIEVEMENTS = compiled.TOTAL_ACHIEVEMENTS;
export const ANNOTATION_TAGS = compiled.ANNOTATION_TAGS;
export const DISAMBIGUATION_ATTRS = compiled.DISAMBIGUATION_ATTRS;
export const findAchievementDef = compiled.findAchievementDef;
`,
    'utf8',
  );
}

function main() {
  ensureVisualDesignRepo();
  syncArtwork();
  packGameAssets();
  packAchievementDefinitions();
  console.log('Synced artwork, game assets, and achievement definitions from visual_design.');
}

main();
