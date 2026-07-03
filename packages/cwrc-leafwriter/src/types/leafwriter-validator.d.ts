declare module '@cwrc/leafwriter-validator' {
  export type {
    EventName,
    InitializeParameters,
    InitializeResponse,
    NodeDetail,
    NodeType,
    PossibleNodesAt,
    PossibleNodesAtOptions,
    Target,
    TargetSelection,
  } from '../../../cwrc-leafwriter-validator/src/types';

  export type {
    ErrorNames,
    ValidationError,
    ValidationErrorElement,
    ValidationErrorTarget,
    ValidationResponse,
  } from '../../../cwrc-leafwriter-validator/src/validate';

  export type ValidatorType = typeof import('../../../cwrc-leafwriter-validator/src/Validator').default;
}
