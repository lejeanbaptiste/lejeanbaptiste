import { IContext } from 'overmind';
import {
  createActionsHook,
  createEffectsHook,
  createReactionHook,
  createStateHook,
} from 'overmind-react';
import { namespaced } from 'overmind/config';
import * as auth from './auth';
import * as editor from './editor';
import * as storage from './storage';
import * as ui from './ui';


export const config = namespaced({
  auth,
  editor,
  storage,
  ui,
});

export type Context = IContext<typeof config>;

export const useAppState = createStateHook<Context>();
export const useActions = createActionsHook<Context>();
export const useEffects = createEffectsHook<Context>();
export const useReaction = createReactionHook<Context>();
