import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FilterDramaOutlinedIcon from '@mui/icons-material/FilterDramaOutlined';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FormatAlignLeftOutlinedIcon from '@mui/icons-material/FormatAlignLeftOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import FeatherIcon from '@src/assets/icons/Feather';
import OrcidIcon from '@src/assets/icons/OrcidIcon';
import { Gitlab } from 'mdi-material-ui';

const icons = new Map([
  ['github', GitHubIcon],
  ['gitlab', Gitlab],
  ['orcid', OrcidIcon],
  ['fingerprint', FingerprintIcon],
  ['blankPage', InsertDriveFileOutlinedIcon],
  ['letter', MailOutlinedIcon],
  ['feather', FeatherIcon],
  ['download', CloudDownloadOutlinedIcon],
  ['save', CloudQueueIcon],
  ['recentDocument', DescriptionOutlinedIcon],
  ['saveAs', FilterDramaOutlinedIcon],
  ['prose', FormatAlignLeftOutlinedIcon],
  ['open', FolderOpenIcon],
  ['newDocument', ArticleOutlinedIcon],
]);

export const getIcon = (name: string) => {
  const icon = icons.get(name);
  if (!icon) return FingerprintIcon;
  return icon;
};
