import type { Leafwriter } from '@cwrc/leafwriter';
import { TimerService, type ITimerService } from './timerService';

type State = {
  autosave: boolean;
  contentLastSaved?: string;
  isDirty: boolean;
  isSaving: boolean;
  leafWriter?: Leafwriter;
  libLoaded: boolean;
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
