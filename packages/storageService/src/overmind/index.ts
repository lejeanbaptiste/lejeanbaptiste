import { IContext } from 'overmind';
import {
  createActionsHook,
  createEffectsHook,
  // createReactionHook,
  createStateHook,
} from 'overmind-react';
import { namespaced } from 'overmind/config';
import * as cloud from './cloud';
import * as common from './common';
import * as local from './local';
import * as ui from './ui';

export const config = namespaced({
  common,
  cloud,
  local,
  ui,
});

export type Context = IContext<typeof config>;

export const useAppState = createStateHook<Context>();
export const useActions = createActionsHook<Context>();
export const useEffects = createEffectsHook<Context>();
// export const useReaction = createReactionHook<Context>();
