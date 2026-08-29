import { FETCH_HEADERS } from './wikisource-parallel.mjs';

const PERSON_QIDS = new Set(['Q5', 'Q215627']);

const entityId = (claim) => claim?.mainsnak?.datavalue?.value?.id || null;
const stringValue = (claim) => claim?.mainsnak?.datavalue?.value || null;
const timeValue = (claim) => claim?.mainsnak?.datavalue?.value?.time || null;

const pickLabel = (entity) => {
  const labels = entity?.labels || {};
  return (
    labels['zh-hant']?.value ||
    labels.zh?.value ||
    labels.mul?.value ||
    labels.en?.value ||
    labels.ja?.value ||
    Object.values(labels)[0]?.value ||
    entity?.id ||
    ''
  );
};

export const parseWikidataEntities = (payload) => payload?.entities || {};

export const isPersonItem = (entity) => {
  const claims = entity?.claims?.P31 || [];
  return claims.some((claim) => PERSON_QIDS.has(entityId(claim)));
};

export const summarizeWikidataWork = (work, extras = {}) => {
  if (!work) {
    return {
      qid: null,
      title: '',
      language: '',
      publicationDate: null,
      ctextWorkId: null,
      authors: [],
      isPerson: false,
    };
  }

  const authors = (work.claims?.P50 || [])
    .map((claim) => entityId(claim))
    .filter(Boolean)
    .map((qid) => ({
      qid,
      name: extras[qid] ? pickLabel(extras[qid]) : qid,
    }));

  const langQid = entityId(work.claims?.P407?.[0]);
  const dateRaw = timeValue(work.claims?.P577?.[0]);
  const publicationDate = dateRaw ? dateRaw.replace(/^\+/, '').slice(0, 10) : null;

  return {
    qid: work.id,
    title: pickLabel(work),
    language: langQid === 'Q37041' || langQid === 'Q35137' ? 'lzh' : langQid || '',
    languageQid: langQid,
    publicationDate,
    ctextWorkId: stringValue(work.claims?.P4517?.[0]) || null,
    authors,
    isPerson: isPersonItem(work),
  };
};

export async function fetchWikidataEntities(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
    action: 'wbgetentities',
    ids: unique.join('|'),
    props: 'labels|claims',
    languages: 'zh|zh-hant|zh-hans|en|ja|lzh|mul',
    format: 'json',
  }).toString()}`;
  const response = await fetch(url, { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`Wikidata API HTTP ${response.status}`);
  }
  const data = await response.json();
  return parseWikidataEntities(data);
}

export async function fetchWikidataWorkMetadata(qid) {
  if (!qid) return summarizeWikidataWork(null);
  const entities = await fetchWikidataEntities([qid]);
  const work = entities[qid];
  if (!work) return summarizeWikidataWork(null);
  if (isPersonItem(work)) {
    throw new Error(
      `Wikidata item ${qid} is a person, not a work. Open the work page rather than the author page.`,
    );
  }
  const authorIds = (work.claims?.P50 || []).map((claim) => entityId(claim)).filter(Boolean);
  const extras = authorIds.length ? await fetchWikidataEntities(authorIds) : {};
  return summarizeWikidataWork(work, extras);
}
