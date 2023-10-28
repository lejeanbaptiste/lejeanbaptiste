import { MarkupPanel, TocPanel } from '../panels';
import { PanelId, PanelProp } from '../types';
import { Entities } from './Entities';

export const Panel: Record<PanelId, PanelProp> = {
  toc: { id: 'toc', label: 'Table of Contents' },
  markup: { id: 'markup', label: 'Markup' },
  entities: { id: 'entities', label: 'Entities' },
  imageViewer: { id: 'imageViewer', label: 'Image Viwer' },
  xmlViewer: { id: 'xmlViewer', label: 'XML Viewer' },
  validate: { id: 'validate', label: 'Validate' },
  nerve: { id: 'nerve', label: 'Nerve' },
};

export const PanelComponent: Record<'toc' | 'markup' | 'entities', React.ReactNode> = {
  toc: <TocPanel />,
  markup: <MarkupPanel />,
  entities: <Entities />,
};
