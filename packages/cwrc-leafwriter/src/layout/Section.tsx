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
    // Applies the persisted collapsed state once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ref?.current?.isCollapsed) ref.current.expand();
    // Indexing by `side` inline is deliberate: this panel only cares about its own
    // side of the layout, not the whole layout object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout[side]?.activePanel]);

  useEffect(() => {
    ref.current?.isCollapsed ? ref.current.expand() : ref.current?.collapse();
  }, [ref?.current?.isCollapsed]);

  return (
    <PanelSection ref={ref} id={side} {...props}>
      {
        PanelComponent[
          //@ts-expect-error
          layout[side].activePanel
        ]
      }
    </PanelSection>
  );
};
