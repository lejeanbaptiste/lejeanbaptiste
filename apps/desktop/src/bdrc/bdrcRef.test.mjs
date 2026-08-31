#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBdrcRef, looksLikeBdrcRef } from './bdrcRef.mjs';

test('bare and prefixed UT ids pass through', () => {
  assert.deepEqual(parseBdrcRef('UT4CZ5369_I1KG9127_0000'), {
    utId: 'UT4CZ5369_I1KG9127_0000',
    from: 'ut',
  });
  assert.equal(parseBdrcRef('bdr:UT4CZ5369_I1KG9127_0000').utId, 'UT4CZ5369_I1KG9127_0000');
  assert.equal(
    parseBdrcRef('https://purl.bdrc.io/resource/UT4CZ5369_I1KG9127_0000.ttl').utId,
    'UT4CZ5369_I1KG9127_0000',
  );
});

test('a VE volume id is mapped to the paginated UT…_0000', () => {
  assert.deepEqual(parseBdrcRef('VE4CZ5369_I1KG9127'), {
    utId: 'UT4CZ5369_I1KG9127_0000',
    from: 've',
  });
});

test('a BUDA reader URL: openEtext=bdr:VE… is resolved', () => {
  const url =
    'https://library.bdrc.io/show/bdr:IE4CZ5369?scope=bdr:IE4CZ5369&openEtext=bdr:VE4CZ5369_I1KG9127&startChar=1&back=bdr%3AMW4CZ5369';
  assert.deepEqual(parseBdrcRef(url), { utId: 'UT4CZ5369_I1KG9127_0000', from: 've' });
});

test('reader URL with openEtext=bdr:UT… keeps the UT', () => {
  const url = 'https://library.bdrc.io/show/bdr:IE1?openEtext=bdr:UT9_I9_0000&startChar=0';
  assert.deepEqual(parseBdrcRef(url), { utId: 'UT9_I9_0000', from: 'ut' });
});

test('a work / instance ref is rejected with guidance', () => {
  assert.throws(() => parseBdrcRef('bdr:MW4CZ5369'), /work\/instance/);
  assert.throws(() => parseBdrcRef('bdr:WA0BC001'), /work\/instance/);
});

test('an IE reader URL with no openEtext is rejected', () => {
  assert.throws(
    () => parseBdrcRef('https://library.bdrc.io/show/bdr:IE4CZ5369'),
    /work\/instance|recognisable/,
  );
});

test('empty and junk inputs throw', () => {
  assert.throws(() => parseBdrcRef(''), /Paste a BDRC/);
  assert.throws(() => parseBdrcRef('hello world'), /Not a recognisable/);
});

test('looksLikeBdrcRef is permissive for enabling the button', () => {
  assert.equal(looksLikeBdrcRef('UT1_I1_0000'), true);
  assert.equal(looksLikeBdrcRef('VE1_I1'), true);
  assert.equal(looksLikeBdrcRef('https://library.bdrc.io/show/bdr:IE1'), true);
  assert.equal(looksLikeBdrcRef('nope'), false);
});
