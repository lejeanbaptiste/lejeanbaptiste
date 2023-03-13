import React from 'react';
import { StructureTree, Toc } from '../panels';
import { PanelId, PanelProp } from '../types';
import { Entities } from './Entities';

export const panel: Record<PanelId, PanelProp> = {
  toc: { id: 'toc', label: 'Table of Contents' },
  structure: { id: 'structure', label: 'Structure' },
  entities: { id: 'entities', label: 'Entities' },
  imageViewer: { id: 'imageViewer', label: 'Image Viwer' },
  xmlViewer: { id: 'xmlViewer', label: 'XML Viewer' },
  validate: { id: 'validate', label: 'Validate' },
  nerve: { id: 'nerve', label: 'Nerve' },
};

export const PanelComponent: Record<'toc' | 'structure' | 'entities', React.ReactNode> = {
  toc: <Toc />,
  structure: <StructureTree />,
  entities: <Entities />,
};
