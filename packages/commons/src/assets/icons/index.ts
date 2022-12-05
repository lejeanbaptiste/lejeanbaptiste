import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CallMadeIcon from '@mui/icons-material/CallMade';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FilterDramaOutlinedIcon from '@mui/icons-material/FilterDramaOutlined';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FormatAlignLeftOutlinedIcon from '@mui/icons-material/FormatAlignLeftOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import TranslateIcon from '@mui/icons-material/Translate';
import { FeatherIcon, OrcidIcon } from '@src/assets/icons';
import { Gitlab } from 'mdi-material-ui';

export * from './Feather';
export * from './OrcidIcon';
export * from './TeaIcon';

const icons = new Map([
  ['article', ArticleOutlinedIcon],
  ['brightness4', Brightness4Icon],
  ['brightness7', Brightness7Icon],
  ['callMade', CallMadeIcon],
  ['ChevronRight', ChevronRightIcon],
  ['cloud', CloudOutlinedIcon],
  ['cloudDownload', CloudDownloadOutlinedIcon],
  ['cloudOffOutlined', CloudOffOutlinedIcon],
  ['cloudQueue', CloudQueueIcon],
  ['computer', ComputerIcon],
  ['contentPaste', ContentPasteIcon],
  ['darkModeIcon', DarkModeIcon],
  ['description', DescriptionOutlinedIcon],
  ['feather', FeatherIcon],
  ['filterDrama', FilterDramaOutlinedIcon],
  ['fingerPrint', FingerprintIcon],
  ['folderOpen', FolderOpenIcon],
  ['formatAlignLeft', FormatAlignLeftOutlinedIcon],
  ['github', GitHubIcon],
  ['gitlab', Gitlab],
  ['insertDriveFile', InsertDriveFileOutlinedIcon],
  ['logout', LogoutIcon],
  ['mail', MailOutlinedIcon],
  ['orcid', OrcidIcon],
  ['PrivacyTip', PrivacyTipIcon],
  ['settings', SettingsIcon],
  ['settingsBrightness', SettingsBrightnessIcon],
  ['translate', TranslateIcon],
]);

const iconsAlias = new Map([
  ['arrowTopRight', 'callMade'],
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
