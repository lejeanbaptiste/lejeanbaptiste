import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FilterDramaOutlinedIcon from '@mui/icons-material/FilterDramaOutlined';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FormatAlignLeftOutlinedIcon from '@mui/icons-material/FormatAlignLeftOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import { FeatherIcon, OrcidIcon } from '@src/assets/icons';
import { Gitlab } from 'mdi-material-ui';

export * from './Feather';
export * from './OrcidIcon';
export * from './TeaIcon';

const icons = new Map([
  ['article', ArticleOutlinedIcon],
  ['cloud', CloudOutlinedIcon],
  ['cloudDownload', CloudDownloadOutlinedIcon],
  ['cloudQueue', CloudQueueIcon],
  ['computer', ComputerIcon],
  ['contentPaste', ContentPasteIcon],
  ['description', DescriptionOutlinedIcon],
  ['feather', FeatherIcon],
  ['filterDrama', FilterDramaOutlinedIcon],
  ['fingerPrint', FingerprintIcon],
  ['folderOpen', FolderOpenIcon],
  ['formatAlignLeft', FormatAlignLeftOutlinedIcon],
  ['github', GitHubIcon],
  ['gitlab', Gitlab],
  ['insertDriveFile', InsertDriveFileOutlinedIcon],
  ['mail', MailOutlinedIcon],
  ['orcid', OrcidIcon],
]);

const iconsAlias = new Map([
  ['blankPage', 'insertDriveFile'],
  ['download', 'cloudDownload'],
  ['letter', 'mail'],
  ['paste', 'contentPaste'],
  ['prose', 'formatAlignLeft'],
  ['recent', 'description'],
  ['sample', 'article'],
  ['save', 'cloudQueue'],
  ['saveAs', 'filterDrama'],
  ['template', 'insertDriveFile'],
]);

export const getIcon = (name: string) => {
  const iconName = iconsAlias.get(name) ?? name;
  const icon = icons.get(iconName);
  if (!icon) return FingerprintIcon;
  return icon;
};
