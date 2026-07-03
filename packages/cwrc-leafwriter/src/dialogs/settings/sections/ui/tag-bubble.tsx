import { ListItem, ListItemText, Switch } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';

export const TagBubble = () => {
  const { t } = useTranslation();
  const { showTagBubble } = useAppState().editor;
  const { toggleShowTagBubble } = useActions().editor;

  return (
    <ListItem dense disableGutters sx={{ py: 0.15 }}>
      <ListItemText
        primary={t('LW.settings.editor.show_tag_bubble', 'Show tag name bubble')}
        primaryTypographyProps={{ sx: { fontSize: '0.875rem' } }}
      />
      <Switch
        checked={showTagBubble}
        onChange={(_e, value) => toggleShowTagBubble(value)}
        size="small"
      />
    </ListItem>
  );
};
