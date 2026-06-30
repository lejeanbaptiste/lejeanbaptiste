import LabelIcon from '@mui/icons-material/Label';
import { ListItem, ListItemIcon, ListItemText, Switch } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';

export const TagBubble = () => {
  const { t } = useTranslation();
  const { showTagBubble } = useAppState().editor;
  const { toggleShowTagBubble } = useActions().editor;

  return (
    <ListItem dense disableGutters>
      <ListItemIcon sx={{ minWidth: 32 }}>
        <LabelIcon sx={{ height: 18, width: 18 }} />
      </ListItemIcon>
      <ListItemText
        primary={t('LW.settings.editor.show_tag_bubble', 'Show tag name bubble')}
        secondary={t(
          'LW.settings.editor.show_tag_bubble_desc',
          'Display a label above the cursor when inside a tagged region',
        )}
        primaryTypographyProps={{ variant: 'body2' }}
        secondaryTypographyProps={{ variant: 'caption' }}
      />
      <Switch
        checked={showTagBubble}
        onChange={(_e, value) => toggleShowTagBubble(value)}
        size="small"
      />
    </ListItem>
  );
};
