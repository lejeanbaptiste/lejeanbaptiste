import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import EditIcon from '@mui/icons-material/Edit';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import PlaceIcon from '@mui/icons-material/Place';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ReportRoundedIcon from '@mui/icons-material/ReportRounded';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';

import BookIcon from '../icons/custom/Book';
import BoxOpenIcon from '../icons/custom/BoxOpen';
import CitationCardIcon from '../icons/custom/CitationCard';
import OrganizationIcon from '../icons/custom/Organization';
import PersonIcon from '../icons/custom/Person';

import type { SvgIconTypeMap } from '@mui/material/SvgIcon';
import type { OverridableComponent } from '@mui/material/OverridableComponent';

const icons: Map<
  string,
  OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
    muiName: string;
  }
> = new Map();
icons.set('add', AddCircleOutlineIcon);
icons.set('remove', RemoveCircleOutlineIcon);
icons.set('edit', EditIcon);
icons.set('copy', ContentCopyIcon);
icons.set('paste', ContentPasteIcon);
icons.set('split', CallSplitIcon);
icons.set('merge', MergeTypeIcon);

icons.set('person', PersonIcon);
icons.set('place', PlaceIcon);
icons.set('organization', OrganizationIcon);
icons.set('title', BookIcon);
icons.set('referencing_string', BoxOpenIcon);
icons.set('citation', CitationCardIcon);
icons.set('note', StickyNote2Icon);
icons.set('date', EventRoundedIcon);
icons.set('correction', ReportRoundedIcon);
icons.set('keyword', VpnKeyRoundedIcon);
icons.set('link', LinkRoundedIcon);

icons.set('tags', LabelRoundedIcon);

icons.set('block', BlockIcon);

export const useUI = () => {
  return {
    getIcon: (name?: string) => {
      if (!name) return null;
      const icon = icons.get(name);
      if (!icon) return null;
      return icon;
    },
  };
};

export default useUI;
