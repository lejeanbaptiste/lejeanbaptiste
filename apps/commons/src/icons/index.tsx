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
import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import TranslateIcon from '@mui/icons-material/Translate';
import { SvgIcon, type SvgIconProps, type SvgIconTypeMap, createSvgIcon } from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import { FileExportOutline, Gitlab } from 'mdi-material-ui';
import type { IconBaseProps, IconType } from 'react-icons';
import { BiArrowToTop, BiDownload } from 'react-icons/bi';
import { FaFeather, FaOrcid } from 'react-icons/fa';
import { FiExternalLink } from 'react-icons/fi';
import { LuDrama } from 'react-icons/lu';
import { MdOutlineLogout } from 'react-icons/md';
import { RxFileText } from 'react-icons/rx';

export * from './components';

const asMuiIcon = (ReactIcon: IconType, props?: IconBaseProps) => {
  return createSvgIcon(<ReactIcon {...props} />, ReactIcon.name);
};

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
  download: asMuiIcon(BiDownload, { x: 1, y: 1 }),
  drama: LuDrama,
  externalLink: asMuiIcon(FiExternalLink, { x: 1, y: 1 }),
  feather: asMuiIcon(FaFeather, { x: 1, y: 1 }),
  fileExportOutline: FileExportOutline,
  fileText: asMuiIcon(RxFileText, { x: 1, y: 1 }),
  filterDrama: FilterDramaOutlinedIcon,
  fingerPrint: FingerprintIcon,
  folderOpen: FolderOpenIcon,
  formatAlignLeft: FormatAlignLeftOutlinedIcon,
  github: GitHubIcon,
  gitlab: Gitlab,
  helpOutlineRoundedIcon: HelpOutlineRoundedIcon,
  importIcon: asMuiIcon(BiArrowToTop, { x: 1, y: 1 }),
  importExportRoundedIcon: ImportExportRoundedIcon,
  insertDriveFile: InsertDriveFileOutlinedIcon,
  letter: MailOutlinedIcon,
  logout: asMuiIcon(MdOutlineLogout),
  mail: MailOutlinedIcon,
  orcid: asMuiIcon(FaOrcid),
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
  typeof icons extends Record<
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

export interface IconProps extends SvgIconProps {
  name: IconName;
}

export const Icon = (props: IconProps) => {
  const { name, ...rest } = props;
  const icon = icons[name];
  return <SvgIcon component={icon} {...rest} />;
};
