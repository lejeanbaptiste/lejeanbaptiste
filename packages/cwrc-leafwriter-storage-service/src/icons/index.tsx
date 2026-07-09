import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageIcon from '@mui/icons-material/Language';
import GitlabIcon from 'mdi-material-ui/Gitlab';
import { type SvgIconTypeMap } from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';

const icons = {
  cloud: CloudQueueIcon,
  computer: ComputerIcon,
  download: DownloadIcon,
  fileText: DescriptionOutlinedIcon,
  fingerprint: FingerprintIcon,
  github: GitHubIcon,
  gitlab: GitlabIcon,
  paste: ContentPasteIcon,
  url: LanguageIcon,
};

export type IconName =
  typeof icons extends Record<
    infer I,
    OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string }
  >
    ? I
    : never;

export const getIcon = (name: IconName) => {
  return icons[name];
};
