import type { Resource } from '@src/types';
import { TimerService, type TimerServiceProps } from './timerService';

type State = {
  autosave: boolean;
  contentHasChanged: boolean;
  contentLastSaved?: string;
  isSaving: boolean;
  libLoaded: boolean;
  resource?: Resource;
  saveDelayed: boolean;
  timerService: TimerServiceProps;
};

export const state: State = {
  autosave: true,
  contentHasChanged: false,
  isSaving: false,
  libLoaded: false,
  saveDelayed: false,
  timerService: TimerService,
};
