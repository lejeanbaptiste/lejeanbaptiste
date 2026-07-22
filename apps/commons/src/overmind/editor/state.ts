import type { Resource } from '@src/types';

export interface State {
  contentHasChanged: boolean;
  contentLastSaved?: string;
  isSaving: boolean;
  libLoaded: boolean;
  resource?: Resource;
  readonly: boolean;
  saveDelayed: boolean;
}

export const state: State = {
  contentHasChanged: false,
  isSaving: false,
  libLoaded: false,
  readonly: false,
  saveDelayed: false,
};
