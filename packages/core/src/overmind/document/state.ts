import { derived } from 'overmind';
import { Resource } from '../../@types';
import { Context } from '../';

type State = {
  resource?: Resource;
  schemaId: string;
  schemaName: string;
  url?: string;
};

export const state: State = {
  schemaId: '',
  schemaName: derived((state: State, rootState: Context['state']) => {
    const schema = rootState.editor.schemas.find((sch) => sch.id === state.schemaId);
    if (!schema) return '';
    return schema.name;
  })
};
