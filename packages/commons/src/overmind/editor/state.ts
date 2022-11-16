import type { Leafwriter } from '@cwrc/leafwriter';
import type { Resource } from '@src/types';
import { TimerService, type ITimerService } from './timerService';

type State = {
  autosave: boolean;
  contentLastSaved?: string;
  isDirty: boolean;
  isSaving: boolean;
  leafWriter?: Leafwriter;
  libLoaded: boolean;
  resource?: Resource;
  saveDelayed: boolean;
  timerService: ITimerService;
};

export const state: State = {
  autosave: true,
  isDirty: false,
  isSaving: false,
  libLoaded: false,
  saveDelayed: false,
  timerService: TimerService,
};
