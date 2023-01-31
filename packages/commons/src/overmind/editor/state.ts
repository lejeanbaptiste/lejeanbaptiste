import type { Leafwriter } from '@cwrc/leafwriter';
import type { Resource } from '@src/types';
import { TimerService, type TimerServiceProps } from './timerService';

type State = {
  autosave: boolean;
  contentLastSaved?: string;
  contentToBeSaved?: string;
  isDirty: boolean;
  isSaving: boolean;
  // leafWriter?: Leafwriter;
  libLoaded: boolean;
  resource?: Resource;
  saveDelayed: boolean;
  timerService: TimerServiceProps;
};

export const state: State = {
  autosave: true,
  isDirty: false,
  isSaving: false,
  libLoaded: false,
  saveDelayed: false,
  timerService: TimerService,
};
