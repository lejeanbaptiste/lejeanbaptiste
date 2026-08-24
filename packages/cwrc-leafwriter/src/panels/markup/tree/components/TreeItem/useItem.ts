import { useColorScheme, useTheme, type PaletteMode } from '@mui/material';
import { useAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { getIcon, type IconLeafWriter } from '../../../../../icons';
import { detailsHoverTimeOutAtom } from './store';

interface Props {
  content?: string;
  id: string;
  isEntity?: boolean;
  selected?: boolean;
}

const TIME_OUT_SELECT = 350;

export const useItem = ({ content = '', id, isEntity = false, selected = false }: Props) => {
  const theme = useTheme();
  const { mode, systemMode } = useColorScheme();

  const [detailsHoverTimeOut, resetDetailsHoverTimeOut] = useAtom(detailsHoverTimeOutAtom);

  const { entitiesManager } = window.writer;
  let timer: NodeJS.Timeout;

  const [hover, setHover] = useState(false);
  const [details, setDetails] = useState<string | undefined>(undefined);

  const entityType = isEntity ? entitiesManager.getEntity(id)?.getType() : null;
  const color = entityType ? theme.entity[entityType].color.main : theme.vars.palette.primary.main;

  const icon = useMemo(
    () => (entityType ? getIcon(theme.entity[entityType].icon) : getIcon(id as IconLeafWriter)),
    // `entityType` is derived from `id` a few lines above, so `id` already covers
    // it; `theme.entity` is a static palette map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  const inverseThemeMode: PaletteMode = useMemo(
    () => (mode === 'dark' || (mode === 'system' && systemMode === 'dark') ? 'light' : 'dark'),
    [mode, systemMode],
  );

  useEffect(() => {
    !hover && !selected ? clearDetailsTimer() : startDetailsTimer(detailsHoverTimeOut);
    return () => clearTimeout(timer);
    // Keyed to hover alone; selection is handled by the effect below. The timer
    // helpers are redefined every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover]);

  useEffect(() => {
    !selected ? clearDetailsTimer() : startDetailsTimer(TIME_OUT_SELECT);
    return () => clearTimeout(timer);
    // Keyed to selection alone; the timer helpers are redefined every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const startDetailsTimer = (duration: number) => {
    timer = setTimeout(showDetails, duration);
  };

  const clearDetailsTimer = () => {
    setDetails(undefined);
    clearTimeout(timer);
  };

  const showDetails = () => {
    if (hover || selected) {
      setDetails(content);
      resetDetailsHoverTimeOut();
    }
  };

  return {
    color,
    icon,
    inverseThemeMode,
    hover,
    setHover,
    details,
  };
};
