import Leafwriter from '@cwrc/leafwriter/src/index';

type State = {
  leafWriter?: Leafwriter;
  isDirty: boolean;
};

export const state: State = {
  isDirty: false,
};
