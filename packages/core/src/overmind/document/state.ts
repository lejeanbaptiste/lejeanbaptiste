import { derived } from 'overmind';
import { Context } from '../';

interface State {
  loaded: boolean;
  rootName?: string;
  schemaId: string;
  schemaName: string;
  touched: boolean;
  url?: string;
  xml?: string;
}

export const state: State = {
  loaded: false,
  schemaId: '',
  schemaName: derived((state: State, rootState: Context['state']) => {
    const schema = rootState.editor.schemasList.find((sch) => sch.id === state.schemaId);
    if (!schema) return '';
    return schema.name;
  }),
  touched: false,
};
