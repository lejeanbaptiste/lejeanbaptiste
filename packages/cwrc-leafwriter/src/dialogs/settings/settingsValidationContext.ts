import { createContext, useContext } from 'react';
import type { RequiredFieldsValidity } from './useRequiredFieldsValidity';

export interface SettingsValidationState extends RequiredFieldsValidity {
  /** True once the user has tried to close the dialog while invalid. */
  attempted: boolean;
}

const defaultState: SettingsValidationState = {
  isDesktop: false,
  languageValid: true,
  encoderNameValid: true,
  allValid: true,
  attempted: false,
};

export const SettingsValidationContext = createContext<SettingsValidationState>(defaultState);
export const useSettingsValidation = () => useContext(SettingsValidationContext);
