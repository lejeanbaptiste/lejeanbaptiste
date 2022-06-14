import FingerprintIcon from '@mui/icons-material/Fingerprint';
import FormatAlignLeftOutlinedIcon from '@mui/icons-material/FormatAlignLeftOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import { Gitlab } from 'mdi-material-ui';
import FeatherIcon from '../icons/Feather';
import OrcidIcon from '../icons/Orcid';

const icons: Map<string, any> = new Map();
icons.set('github', GitHubIcon);
icons.set('gitlab', Gitlab);
icons.set('orcid', OrcidIcon);
icons.set('fingerprint', FingerprintIcon);

export const getIcon = (name: string): any => {
  const icon = icons.get(name);
  if (!icon) return FingerprintIcon;
  return icon;
};
