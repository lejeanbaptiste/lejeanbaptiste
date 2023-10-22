import { useTheme, type PaletteMode } from '@mui/material';
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
  const { entity, palette } = useTheme();

  const [detailsHoverTimeOut, resetDetailsHoverTimeOut] = useAtom(detailsHoverTimeOutAtom);

  const { entitiesManager } = window.writer;
  let timer: NodeJS.Timeout;

  const [hover, setHover] = useState(false);
  const [details, setDetails] = useState<string | undefined>(undefined);

  const entityType = isEntity ? entitiesManager.getEntity(id)?.getType() : null;
  const color = entityType ? entity[entityType].color.main : palette.primary[palette.mode];

  const icon = useMemo(
    () =>
      entityType
        ? getIcon(entity[entityType].icon as IconLeafWriter)
        : getIcon(id as IconLeafWriter),
    [id]
  );

  const inverseThemeMode: PaletteMode = useMemo(
    () => (palette.mode === 'light' ? 'dark' : 'light'),
    [palette.mode]
  );

  useEffect(() => {
    !hover && !selected ? clearDetailsTimer() : startDetailsTimer(detailsHoverTimeOut);
    return () => clearTimeout(timer);
  }, [hover]);

  useEffect(() => {
    !selected ? clearDetailsTimer() : startDetailsTimer(TIME_OUT_SELECT);
    return () => clearTimeout(timer);
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
