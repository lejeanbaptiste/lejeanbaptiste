import { Context } from '..';
import type { EntityLink, EntryLink, NamedEntityType } from '../../dialogs/entityLookups/types';
import type { DialogLookupType } from '../../js/dialogs/types';
import Entity from '../../js/entities/Entity';
import { EntityType } from '../../types';

export const initiate = (
  { state: { lookups }, actions }: Context,
  { entry, type }: { entry?: Entity; type: DialogLookupType }
) => {
  actions.lookups.setType(type);

  if (entry) {
    const query = entry.getContent()?.trim() ?? '';
    lookups.query = query;
  } else {
    const currentBookmark = window.writer?.editor?.currentBookmark;
    if (!currentBookmark) return;

    if ('rng' in currentBookmark) {
      let query = currentBookmark.rng.toString();
      query = query.trim().replace(/\s+/g, ' '); // remove excess whitespace
      lookups.query = query;
    }
  }

  actions.lookups.search(lookups.query);
};

export const setType = ({ state: { lookups } }: Context, type: EntityType) => {
  lookups.typeEntity = type;
  lookups.typeLookup = type === 'citation' ? 'title' : (type as NamedEntityType);
};

export const search = async ({ state: { lookups }, effects }: Context, query: string) => {
  if (query === '') return [];

  const response = await effects.lookups.api.find({ query, type: lookups.typeLookup });

  lookups.results = response;
  return response;
};

export const processSelected = ({ state: { lookups } }: Context) => {
  let link: EntityLink | undefined;

  if (lookups.selected) {
    const { id, name, repository, uri } = lookups.selected;
    link = {
      id,
      name,
      properties: { lemma: name, uri },
      query: lookups.query,
      repository,
      type: lookups.typeEntity,
      uri,
    };
  }

  if (lookups.manualInput !== '' && lookups.isUriValid) {
    link = {
      id: lookups.manualInput,
      name: lookups.query,
      properties: { lemma: lookups.query, uri: lookups.manualInput },
      query: lookups.query,
      repository: 'custom',
      type: lookups.typeEntity,
      uri: lookups.manualInput,
    };
  }

  return link;
};

export const setSelected = ({ state: { lookups } }: Context, link?: EntryLink) => {
  lookups.selected = link ?? undefined;
  lookups.manualInput = '';
};

export const setQuery = ({ state: { lookups } }: Context, value: string) => {
  lookups.query = value;
};

export const setManualInput = ({ state: { lookups } }: Context, value: string) => {
  lookups.manualInput = value;
};

export const reset = ({ state: { lookups } }: Context) => {
  lookups.manualInput = '';
  lookups.query = '';
  lookups.results = undefined;
  lookups.selected = undefined;
  lookups.typeEntity = 'rs';
  lookups.typeLookup = 'rs';
};
