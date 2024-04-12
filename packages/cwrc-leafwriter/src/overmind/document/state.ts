import { derived } from 'overmind';
import { Context } from '../';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type State = {
  isReload: boolean;
  loaded: boolean;
  rootName?: string;
  schemaId: string;
  schemaName: string;
  touched: boolean;
  url?: string;
  xml?: string;
};

export const state: State = {
  isReload: false,
  loaded: false,
  schemaId: '',
  schemaName: derived((state: State, rootState: Context['state']) => {
    const schema = rootState.editor.schemasList.find((sch) => sch.id === state.schemaId);
    if (!schema) return '';
    return schema.name;
  }),
  touched: false,
};
