import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import HelpCenterIcon from '@mui/icons-material/HelpCenter';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import PanoramaFishEyeIcon from '@mui/icons-material/PanoramaFishEye';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PersonIcon from '@mui/icons-material/Person';
import PlaceIcon from '@mui/icons-material/Place';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import { DotsCircle, LabelVariantOutline, OrderAlphabeticalAscending } from 'mdi-material-ui';
import { BookIcon, BookOutlinedIcon } from './custom/Book';
import { BoxIcon, BoxOutlinedIcon } from './custom/BoxOpen';

import { TagPlus } from 'mdi-material-ui';

import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import EventIcon from '@mui/icons-material/Event';
import FormatQuoteOutlinedIcon from '@mui/icons-material/FormatQuoteOutlined';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import LabelImportantRoundedIcon from '@mui/icons-material/LabelImportantRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import { PlaylistCheck } from 'mdi-material-ui';

import CheckIcon from '@mui/icons-material/Check';

export { BookIcon, BookOutlinedIcon } from './custom/Book';
export { BoxIcon, BoxOutlinedIcon } from './custom/BoxOpen';

const icons = new Map([
  ['ArrowDownwardIcon', ArrowDownwardIcon],
  ['BookIcon', BookIcon],
  ['BookOutlinedIcon', BookOutlinedIcon],
  ['BoxIcon', BoxIcon],
  ['BoxOutlinedIcon', BoxOutlinedIcon],
  ['CheckIcon', CheckIcon],
  ['ClearIcon', ClearIcon],
  ['CloseIcon', CloseIcon],
  ['CodeRoundedIcon', CodeRoundedIcon],
  ['DotsCircle', DotsCircle],
  ['EventIcon', EventIcon],
  ['FormatQuoteIcon', FormatQuoteIcon],
  ['FormatQuoteOutlinedIcon', FormatQuoteOutlinedIcon],
  ['FullscreenExitRoundedIcon', FullscreenExitRoundedIcon],
  ['FullscreenRoundedIcon', FullscreenRoundedIcon],
  ['HelpCenterIcon', HelpCenterIcon],
  ['LabelImportantRoundedIcon', LabelImportantRoundedIcon],
  ['LabelRoundedIcon', LabelRoundedIcon],
  ['LabelVariantOutline', LabelVariantOutline],
  ['LinkRoundedIcon', LinkRoundedIcon],
  ['OrderAlphabeticalAscending', OrderAlphabeticalAscending],
  ['PanoramaFishEyeIcon', PanoramaFishEyeIcon],
  ['PlaceIcon', PlaceIcon],
  ['PlaceOutlinedIcon', PlaceOutlinedIcon],
  ['PlaylistCheck', PlaylistCheck],
  ['PeopleAltIcon', PeopleAltIcon],
  ['PeopleOutlineOutlinedIcon', PeopleOutlineOutlinedIcon],
  ['PersonIcon', PersonIcon],
  ['PersonOutlineOutlinedIcon', PersonOutlineOutlinedIcon],
  ['QuizRoundedIcon', QuizRoundedIcon],
  ['ReplayIcon', ReplayIcon],
  ['SettingsRoundedIcon', SettingsRoundedIcon],
  ['StickyNote2Icon', StickyNote2Icon],
  ['TranslateRoundedIcon', TranslateRoundedIcon],
  ['TagPlus', TagPlus],
  ['VpnKeyRoundedIcon', VpnKeyRoundedIcon],
  ['WarningRoundedIcon', WarningRoundedIcon],
]);

const iconsAlias = new Map([
  ['accept', 'CheckIcon'],
  ['draft', 'DotsCircle'],
  ['change', 'ReplayIcon'],
  ['close', 'CloseIcon'],
  ['citation', 'FormatQuoteIcon'],
  ['citationDraft', 'FormatQuoteOutlinedIcon'],
  ['code', 'CodeRoundedIcon'],
  ['correction', 'WarningRoundedIcon'],
  ['date', 'EventIcon'],
  ['delete', 'ClearIcon'],
  ['fullscreen', 'FullscreenRoundedIcon'],
  ['fullscreenExit', 'FullscreenExitRoundedIcon'],
  ['documentation', 'QuizRoundedIcon'],
  ['keyword', 'VpnKeyRoundedIcon'],
  ['insertTag', 'TagPlus'],
  ['link', 'LinkRoundedIcon'],
  ['note', 'StickyNote2Icon'],
  ['organization', 'PeopleAltIcon'],
  ['organizationDraft', 'PeopleOutlineOutlinedIcon'],
  ['person', 'PersonIcon'],
  ['personDraft', 'PersonOutlineOutlinedIcon'],
  ['place', 'PlaceIcon'],
  ['placeDraft', 'PlaceOutlinedIcon'],
  ['sortAlphabetically', 'OrderAlphabeticalAscending'],
  ['reject', 'ClearIcon'],
  ['settings', 'SettingsRoundedIcon'],
  ['showTagsOn', 'LabelImportantRoundedIcon'],
  ['showTagsOff', 'LabelVariantOutline'],
  ['sortLinear', 'ArrowDownwardIcon'],
  ['sortType', 'LabelRoundedIcon'],
  ['title', 'BookIcon'],
  ['titleDraft', 'BookOutlinedIcon'],
  ['thing', 'BoxIcon'],
  ['thingDraft', 'BoxOutlinedIcon'],
  ['translate', 'TranslateRoundedIcon'],
  ['unknown', 'HelpCenterIcon'],
  ['validate', 'PlaylistCheck'],
  ['vetted', 'PanoramaFishEyeIcon'],
]);

export const getIcon = (name: string) => {
  const iconName = iconsAlias.get(name) ?? name;
  const icon = icons.get(iconName);
  if (!icon) return FingerprintIcon;
  return icon;
};

// export const getSvg = (name: string) => {
//   const icon = svgs.get(name);
//   if (!icon) return LabelIcon;
//   return icon;
// };
