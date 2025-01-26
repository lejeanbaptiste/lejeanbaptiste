import { NamedEntityType } from '@src/types';
import Writer from '../Writer';

export interface LWDialogConfigProps {
  parentEl: JQuery<HTMLElement>;
  type?: NamedEntityType;
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
