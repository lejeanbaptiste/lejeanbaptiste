import { EntityTypes } from '../../js/schema/types';
import { derived } from 'overmind';
import { Context } from '..';
import {
  Authority,
  EntryLink,
  IResult,
  LookupsEntityType,
} from '../../components/entityLookups/types';

type State = {
  isUriValid: boolean;
  manualInput: string;
  query: string;
  results?: Map<Authority, IResult[]>;
  selected?: EntryLink;
  typeEntity: EntityTypes;
  typeLookup: LookupsEntityType;
};

export const state: State = {
  isUriValid: derived((state: State, rootState: Context['state']) => {
    if (!state.manualInput) return true;
    const urlRegex =
      /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/i;
    const isValid = urlRegex.test(state.manualInput);
    return isValid;
  }),
  manualInput: '',
  query: '',
  typeEntity: 'rs',
  typeLookup: 'rs',
};
