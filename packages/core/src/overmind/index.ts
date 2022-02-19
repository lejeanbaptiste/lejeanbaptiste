import { IContext } from 'overmind';
import {
  createActionsHook,
  createEffectsHook,
  createReactionHook,
  createStateHook,
} from 'overmind-react';
import { namespaced } from 'overmind/config';
import * as document from './document';
import * as editor from './editor';
import * as lookups from './lookups';
import * as ui from './ui';
import * as user from './user';
import * as validator from './validator';


export const config = namespaced({
  document,
  editor,
  lookups,
  ui,
  user,
  validator,
});

export type Context = IContext<typeof config>;

export const useAppState = createStateHook<Context>();
export const useActions = createActionsHook<Context>();
export const useEffects = createEffectsHook<Context>();
export const useReaction = createReactionHook<Context>();
