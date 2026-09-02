import { createContext, useContext } from 'react';
import type { SettingsTabId } from './types';

export const SettingsNavigationContext = createContext<((tab: SettingsTabId) => void) | null>(null);

export const useSettingsNavigation = () => useContext(SettingsNavigationContext);
