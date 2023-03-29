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
import { SvgIconTypeMap } from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import { FileExportOutline, Gitlab } from 'mdi-material-ui';
import { FeatherIcon, OrcidIcon } from './components';

export * from './components';

const icons = {
  article: ArticleOutlinedIcon,
  arrowTopRight: CallMadeIcon,
  blankPage: InsertDriveFileOutlinedIcon,
  brightness4: Brightness4Icon,
  brightness7: Brightness7Icon,
  callMade: CallMadeIcon,
  chevronRight: ChevronRightIcon,
  cloud: CloudOutlinedIcon,
  cloudDownload: CloudDownloadOutlinedIcon,
  cloudOffOutlined: CloudOffOutlinedIcon,
  cloudQueue: CloudQueueIcon,
  computer: ComputerIcon,
  contentPaste: ContentPasteIcon,
  darkModeIcon: DarkModeIcon,
  description: DescriptionOutlinedIcon,
  download: CloudDownloadOutlinedIcon,
  feather: FeatherIcon,
  fileExportOutline: FileExportOutline,
  filterDrama: FilterDramaOutlinedIcon,
  fingerPrint: FingerprintIcon,
  folderOpen: FolderOpenIcon,
  formatAlignLeft: FormatAlignLeftOutlinedIcon,
  github: GitHubIcon,
  gitlab: Gitlab,
  insertDriveFile: InsertDriveFileOutlinedIcon,
  letter: MailOutlinedIcon,
  logout: LogoutIcon,
  mail: MailOutlinedIcon,
  orcid: OrcidIcon,
  paste: ContentPasteIcon,
  privacyTip: PrivacyTipIcon,
  prose: FormatAlignLeftOutlinedIcon,
  recent: DescriptionOutlinedIcon,
  sample: ArticleOutlinedIcon,
  save: CloudQueueIcon,
  saveAs: FilterDramaOutlinedIcon,
  settings: SettingsIcon,
  settingsBrightness: SettingsBrightnessIcon,
  template: InsertDriveFileOutlinedIcon,
  translate: TranslateIcon,
};

export type IconName = typeof icons extends Record<
  infer I,
  OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
    muiName: string;
  }
>
  ? I
  : never;

export const getIcon = (name: IconName) => {
  return icons[name];
};
