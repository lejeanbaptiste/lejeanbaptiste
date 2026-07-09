import { MarkupPanel } from '../panels/markup';
import { TocPanel } from '../panels/toc';
import { PanelId, PanelProp } from '../types';

export const Panel: Record<PanelId, PanelProp> = {
  toc: { id: 'toc', label: 'LW.panels.toc' },
  markup: { id: 'markup', label: 'LW.panels.markup' },
  imageViewer: { id: 'imageViewer', label: 'LW.panels.imageViewer' },
  xmlViewer: { id: 'xmlViewer', label: 'LW.panels.xmlViewer' },
  validate: { id: 'validate', label: 'LW.panels.validation' },
};

export const PanelComponent: Record<'toc' | 'markup', React.ReactNode> = {
  toc: <TocPanel />,
  markup: <MarkupPanel />,
};
