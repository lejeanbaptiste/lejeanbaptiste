import FingerprintIcon from '@mui/icons-material/Fingerprint';
import FormatAlignLeftOutlinedIcon from '@mui/icons-material/FormatAlignLeftOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import { Gitlab } from 'mdi-material-ui';
import FeatherIcon from '../icons/Feather';
import OrcidIcon from '../icons/OrcidIcon';

const icons = new Map([
  ['github', GitHubIcon],
  ['gitlab', Gitlab],
  ['orcid', OrcidIcon],
  ['fingerprint', FingerprintIcon],
  ['blankPage', InsertDriveFileOutlinedIcon],
  ['letter', MailOutlinedIcon],
  ['feather', FeatherIcon],
  ['prose', FormatAlignLeftOutlinedIcon],
]);

export const getIcon = (name: string) => {
  const icon = icons.get(name);
  if (!icon) return FingerprintIcon;
  return icon;
};
