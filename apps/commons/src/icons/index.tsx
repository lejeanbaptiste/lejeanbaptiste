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
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import ImportExportRoundedIcon from '@mui/icons-material/ImportExportRounded';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PublishIcon from '@mui/icons-material/Publish';
import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';
import StyleIcon from '@mui/icons-material/Style';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import TranslateIcon from '@mui/icons-material/Translate';
import FileExportOutlineIcon from 'mdi-material-ui/FileExportOutline';
import GitlabIcon from 'mdi-material-ui/Gitlab';
import { SvgIcon, type SvgIconProps, createSvgIcon } from '@mui/material';

export * from './components';

const OrcidIcon = createSvgIcon(
  <path d="M294.75 188.19h-45.92V342h47.47c67.62 0 83.12-51.34 83.12-76.91 0-41.64-26.54-76.9-84.67-76.9zM256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm-80.79 360.76h-29.84v-207.5h29.84zm-14.92-231.14a19.57 19.57 0 1 1 19.57-19.57 19.64 19.64 0 0 1-19.57 19.57zM300 369h-81V161.26h80.6c76.73 0 110.44 54.83 110.44 103.85C410 318.39 368.38 369 300 369z" />,
  'Orcid',
);

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
  drama: FilterDramaOutlinedIcon,
  externalLink: OpenInNewIcon,
  feather: StyleIcon,
  fileExportOutline: FileExportOutlineIcon,
  fileText: DescriptionOutlinedIcon,
  filterDrama: FilterDramaOutlinedIcon,
  fingerPrint: FingerprintIcon,
  folderOpen: FolderOpenIcon,
  formatAlignLeft: FormatAlignLeftOutlinedIcon,
  github: GitHubIcon,
  gitlab: GitlabIcon,
  helpOutlineRoundedIcon: HelpOutlineRoundedIcon,
  importIcon: PublishIcon,
  importExportRoundedIcon: ImportExportRoundedIcon,
  insertDriveFile: InsertDriveFileOutlinedIcon,
  letter: MailOutlinedIcon,
  logout: LogoutIcon,
  mail: MailOutlinedIcon,
  orcid: OrcidIcon,
  paste: ContentPasteIcon,
  privacyTip: PrivacyTipOutlinedIcon,
  prose: FormatAlignLeftOutlinedIcon,
  recent: DescriptionOutlinedIcon,
  reportOutlinedIcon: ReportOutlinedIcon,
  sample: ArticleOutlinedIcon,
  save: CloudQueueIcon,
  saveAs: FilterDramaOutlinedIcon,
  settings: SettingsIcon,
  settingsBrightness: SettingsBrightnessIcon,
  template: InsertDriveFileOutlinedIcon,
  translate: TranslateIcon,
};

export type IconName =
  typeof icons extends Record<infer K, unknown>
    ? K extends keyof typeof icons
      ? K
      : never
    : never;

export const getIcon = (name: IconName) => {
  return icons[name];
};

export interface IconProps extends SvgIconProps {
  name: IconName;
}

export const Icon = (props: IconProps) => {
  const { name, ...rest } = props;
  const icon = icons[name];
  return <SvgIcon component={icon} {...rest} />;
};
