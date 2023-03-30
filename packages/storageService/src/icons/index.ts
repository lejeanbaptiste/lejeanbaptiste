import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import GitHubIcon from '@mui/icons-material/GitHub';
import { SvgIconTypeMap } from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import { Gitlab } from 'mdi-material-ui';

const icons = {
  cloud: CloudQueueIcon,
  computer: ComputerIcon,
  fingerprint: FingerprintIcon,
  github: GitHubIcon,
  gitlab: Gitlab,
  paste: ContentPasteIcon,
};

export type IconName = typeof icons extends Record<
  infer I,
  OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string }
>
  ? I
  : never;

export const getIcon = (name: IconName) => {
  return icons[name];
};
