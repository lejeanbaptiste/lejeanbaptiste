import { derived } from 'overmind';
import { Context } from '..';
import type { AuthorityLookupResult, EntryLink, NamedEntityType } from '../../types/authority';
import { EntityType } from '../../types';
import { urlRegex } from '../../utilities';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type State = {
  isUriValid: boolean;
  manualInput: string;
  query: string;
  results?: Map<string, AuthorityLookupResult[]>;
  selected?: EntryLink;
  typeEntity: EntityType;
  typeLookup: NamedEntityType;
};

export const state: State = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isUriValid: derived((state: State, _rootState: Context['state']) => {
    if (!state.manualInput) return true;
    return urlRegex.test(state.manualInput);
  }),
  manualInput: '',
  query: '',
  typeEntity: 'thing',
  typeLookup: 'thing',
};
