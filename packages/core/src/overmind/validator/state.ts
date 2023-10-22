interface State {
  hasSchema: boolean;
  hasWorkerValidator: boolean;
  validationErrors: number;
}

export const state: State = {
  hasSchema: false,
  hasWorkerValidator: false,
  validationErrors: 0,
};
