import Writer from '../Writer';

export type DialogLookupType = 'citation' | 'organization' | 'person' | 'place' | 'rs' | 'title';

export interface LWDialogConfigProps {
  parentEl: JQuery<HTMLElement>;
  type?: DialogLookupType;
  writer: Writer;
}

export interface LWDialogProps {
  show: (config?: any) => void;
  destroy: () => void;

  confirm?: (config: any) => void;

  getOpenDialogs?: () => JQuery<HTMLElement>[];

  setText?: (value: string) => void;
  setValue?: (value: number | boolean) => void;
  hide?: () => void;
}
