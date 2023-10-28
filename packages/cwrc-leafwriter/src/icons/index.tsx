import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BlockIcon from '@mui/icons-material/Block';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import EditIcon from '@mui/icons-material/Edit';
import EventIcon from '@mui/icons-material/Event';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatQuoteOutlinedIcon from '@mui/icons-material/FormatQuoteOutlined';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import GitHubIcon from '@mui/icons-material/GitHub';
import HelpCenterIcon from '@mui/icons-material/HelpCenter';
import LabelImportantRoundedIcon from '@mui/icons-material/LabelImportantRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import MergeRoundedIcon from '@mui/icons-material/MergeRounded';
import PanoramaFishEyeIcon from '@mui/icons-material/PanoramaFishEye';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import PlaceIcon from '@mui/icons-material/Place';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import ShortTextIcon from '@mui/icons-material/ShortText';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import StreamIcon from '@mui/icons-material/Stream';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import { SvgIconTypeMap, createSvgIcon } from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import {
  CloudSyncOutline,
  DotsCircle,
  Gitlab,
  LabelMultipleOutline,
  LabelVariantOutline,
  OrderAlphabeticalAscending,
  PlaylistCheck,
  ShuffleVariant,
  TagPlus,
} from 'mdi-material-ui';
import type { IconBaseProps, IconType } from 'react-icons';
import { FaBoxOpen, FaUserAlt, FaUsers } from 'react-icons/fa';
import { ImBook } from 'react-icons/im';
import { BookOutlinedIcon } from './custom/Book';
import BoxOpenIcon, { BoxIcon, BoxOutlinedIcon } from './custom/BoxOpen';
import titleIcon from './svg/book-solid.svg';
import rsIcon from './svg/box-open-solid.svg';
import iconCitation from './svg/citation.svg';
import validateIcon from './svg/clipboard-check-solid.svg';
import codeIcon from './svg/code-solid.svg';
import editIcon from './svg/edit-solid.svg';
import EventIconSVG from './svg/event.svg';
import markupFileIcon from './svg/file-code-solid.svg';
import loadIcon from './svg/folder-open-solid.svg';
import KeyIcon from './svg/key.svg';
import LabelIcon from './svg/label.svg';
import LinkIcon from './svg/link.svg';
import iconPerson from './svg/person.svg';
import PlaceIconSVG from './svg/place.svg';
import relationIcon from './svg/project-diagram-solid.svg';
import saveIcon from './svg/save-solid.svg';
import signOutIcon from './svg/sign-out-alt-solid.svg';
import NoteIcon from './svg/sticky-note.svg';
import tagEditIcon from './svg/tag-edit-solid.svg';
import tagRemoveIcon from './svg/tag-remove-solid.svg';
import TranslationIcon from './svg/translate.svg';
import triangleExclamationIcon from './svg/triangle-exclamation-solid.svg';
import iconOrg from './svg/users-solid.svg';

export { BookIcon, BookOutlinedIcon } from './custom/Book';
export { BoxIcon, BoxOutlinedIcon } from './custom/BoxOpen';

const asMuiIcon = (ReactIcon: IconType, props?: IconBaseProps) => {
  return createSvgIcon(<ReactIcon {...props} />, ReactIcon.name);
};

const icons = {
  accept: CheckIcon,
  add: AddCircleOutlineIcon,
  arrowDownwardIcon: ArrowDownwardIcon,
  arrowForwardIosIcon: ArrowForwardIosIcon,
  block: BlockIcon,
  BookIcon: asMuiIcon(ImBook),
  BookOutlinedIcon: BookOutlinedIcon,
  BoxIcon: asMuiIcon(FaBoxOpen),
  BoxOutlinedIcon: BoxOutlinedIcon,
  change: ReplayIcon,
  checkIcon: CheckIcon,
  citation: FormatQuoteIcon,
  citationDraft: FormatQuoteOutlinedIcon,
  ClearIcon: ClearIcon,
  close: CloseIcon,
  CloseIcon: CloseIcon,
  cloud: CloudQueueIcon,
  cloudSync: CloudSyncOutline,
  code: CodeRoundedIcon,
  CodeRoundedIcon: CodeRoundedIcon,
  computer: ComputerIcon,
  copy: ContentCopyIcon,
  correction: WarningRoundedIcon,
  date: EventIcon,
  delete: ClearIcon,
  documentation: QuizRoundedIcon,
  DotsCircle: DotsCircle,
  draft: DotsCircle,
  dragAndDrop: ShuffleVariant,
  edit: EditIcon,
  entities: StreamIcon,
  entitiesTag: StyleOutlinedIcon,
  EventIcon: EventIcon,
  fingerprint: FingerprintIcon,
  FormatQuoteIcon: FormatQuoteIcon,
  FormatQuoteOutlinedIcon: FormatQuoteOutlinedIcon,
  fullscreen: FullscreenRoundedIcon,
  fullscreenExit: FullscreenExitRoundedIcon,
  FullscreenExitRoundedIcon: FullscreenExitRoundedIcon,
  FullscreenRoundedIcon: FullscreenRoundedIcon,
  github: GitHubIcon,
  gitlab: Gitlab,
  HelpCenterIcon: HelpCenterIcon,
  imageViewer: PhotoLibraryRoundedIcon,
  insertTag: TagPlus,
  invalid: WarningAmberRoundedIcon,
  keyword: VpnKeyRoundedIcon,
  LabelImportantRoundedIcon: LabelImportantRoundedIcon,
  LabelRoundedIcon: LabelRoundedIcon,
  LabelVariantOutline: LabelVariantOutline,
  link: LinkRoundedIcon,
  LinkRoundedIcon: LinkRoundedIcon,
  merge: MergeRoundedIcon,
  MergeRoundedIcon: MergeRoundedIcon,
  note: StickyNote2Icon,
  OrderAlphabeticalAscending: OrderAlphabeticalAscending,
  organization: asMuiIcon(FaUsers, { x: 1, y: 1 }),
  organizationDraft: PeopleOutlineOutlinedIcon,
  PanoramaFishEyeIcon: PanoramaFishEyeIcon,
  paste: ContentPasteIcon,
  PeopleAltIcon: PeopleAltIcon,
  PeopleOutlineOutlinedIcon: PeopleOutlineOutlinedIcon,
  person: asMuiIcon(FaUserAlt, { x: 1, y: 1 }),
  personDraft: PersonOutlineOutlinedIcon,
  PersonIcon: asMuiIcon(FaUserAlt, { x: 1, y: 1 }),
  PersonOutlineOutlinedIcon: PersonOutlineOutlinedIcon,
  place: PlaceIcon,
  placeDraft: PlaceOutlinedIcon,
  PlaceIcon: PlaceIcon,
  PlaceOutlinedIcon: PlaceOutlinedIcon,
  PlaylistCheck: PlaylistCheck,
  QuizRoundedIcon: QuizRoundedIcon,
  referencing_string: BoxOpenIcon,
  reject: ClearIcon,
  remove: RemoveCircleOutlineIcon,
  rs: asMuiIcon(FaBoxOpen),
  ReplayIcon: ReplayIcon,
  reset: RestartAltIcon,
  settings: SettingsRoundedIcon,
  SettingsRoundedIcon: SettingsRoundedIcon,
  shortText: ShortTextIcon,
  showTagsOff: LabelVariantOutline,
  showTagsOn: LabelImportantRoundedIcon,
  ShuffleVariant: ShuffleVariant,
  sortAlphabetically: OrderAlphabeticalAscending,
  sortLinear: ArrowDownwardIcon,
  sortType: LabelRoundedIcon,
  split: CallSplitIcon,
  StickyNote2Icon: StickyNote2Icon,
  structure: AccountTreeRoundedIcon,
  tagMultiSelection: LabelMultipleOutline,
  TagPlus: TagPlus,
  TagRoundedIcon: TagRoundedIcon,
  tags: LabelRoundedIcon,
  textNode: TagRoundedIcon,
  thing: BoxIcon,
  thingDraft: BoxOutlinedIcon,
  title: asMuiIcon(ImBook, { x: 1, y: 1 }),
  titleDraft: BookOutlinedIcon,
  toc: FormatListBulletedIcon,
  translate: TranslateRoundedIcon,
  TranslateRoundedIcon: TranslateRoundedIcon,
  unknown: HelpCenterIcon,
  validate: PlaylistCheck,
  vetted: PanoramaFishEyeIcon,
  VpnKeyRoundedIcon: VpnKeyRoundedIcon,
  WarningRoundedIcon: WarningRoundedIcon,
  xmlViewer: CodeRoundedIcon,
};

export type IconLeafWriter = typeof icons extends Record<
  infer I,
  OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
    muiName: string;
  }
>
  ? I
  : never;

export const getIcon = (name: IconLeafWriter) => {
  return icons[name];
};

const svgs = new Map([
  ['tags', LabelIcon],
  ['person', iconPerson],
  ['place', PlaceIconSVG],
  ['title', titleIcon],
  ['date', EventIconSVG],
  ['organization', iconOrg],
  ['citation', iconCitation],
  ['note', NoteIcon],
  ['correction', triangleExclamationIcon],
  ['keyword', KeyIcon],
  ['link', LinkIcon],
  ['rs', rsIcon],
  ['translation', TranslationIcon],
  ['relation', relationIcon],
  ['tag-edit', tagEditIcon],
  ['tag-remove', tagRemoveIcon],
  ['code', codeIcon],
  ['markup-file', markupFileIcon],
  ['edit', editIcon],
  ['validate', validateIcon],
  ['save', saveIcon],
  ['load', loadIcon],
  ['sign-out', signOutIcon],
]);

export const getSvg = (name: string) => {
  const icon = svgs.get(name);
  if (!icon) return LabelIcon;
  return icon;
};
