import { derived } from 'overmind';
import { Context } from '../';

type State = {
  loaded: boolean;
  rootName?: string;
  schemaId: string;
  schemaName: string;
  xml?: string;
  url?: string;
};

export const state: State = {
  loaded: false,
  schemaId: '',
  schemaName: derived((state: State, rootState: Context['state']) => {
    const schema = rootState.editor.schemasList.find((sch) => sch.id === state.schemaId);
    if (!schema) return '';
    return schema.name;
  }),
};
