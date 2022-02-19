import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import GitHubIcon from '@mui/icons-material/GitHub';
import type { OverridableComponent } from '@mui/material/OverridableComponent';
import type { SvgIconTypeMap } from '@mui/material/SvgIcon';
import { Gitlab } from 'mdi-material-ui';

const icons: Map<
  string,
  OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
    muiName: string;
  }
> = new Map([
  ['github', GitHubIcon],
  ['gitlab', Gitlab],
  ['fingerprint', FingerprintIcon],
  ['cloud', CloudQueueIcon],
  ['computer', ComputerIcon],
  ['paste', ContentPasteIcon],
]);

export const getIcon = (name: string): any => {
  const icon = icons.get(name);
  if (!icon) return FingerprintIcon;
  return icon;
};
