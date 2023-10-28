import { useEffect, useRef } from 'react';
import {
  ImperativePanelHandle,
  Panel as PanelSection,
  type PanelProps,
} from 'react-resizable-panels';
import { useAppState } from '../overmind';
import type { Side } from '../types';
import { PanelComponent } from './Utilities';

interface SectionProps extends PanelProps {
  side: Side;
}

export const Section = ({ side, ...props }: SectionProps) => {
  const { layout } = useAppState().ui;

  const ref = useRef<ImperativePanelHandle>(null);

  useEffect(() => {
    if (ref?.current && layout[side]?.collapsed) ref.current.collapse();
  }, []);

  useEffect(() => {
    if (ref?.current?.getCollapsed()) ref.current.expand();
  }, [layout[side]?.activePanel]);

  useEffect(() => {
    ref.current?.getCollapsed() ? ref.current.expand() : ref.current?.collapse();
  }, [ref?.current?.getCollapsed()]);

  return (
    <PanelSection ref={ref} id={side} {...props}>
      {
        PanelComponent[
          //@ts-ignore
          layout[side].activePanel
        ]
      }
    </PanelSection>
  );
};
