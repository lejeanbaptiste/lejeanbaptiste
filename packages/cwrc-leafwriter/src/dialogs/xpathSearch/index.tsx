import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isElement } from '../../utilities';
import type { IDialog } from '../type';

interface XPathResultItem {
  id?: string;
  label: string;
  xpath: string;
}

export const XPathSearchDialog = ({ id, onClose, open = false }: IDialog) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<XPathResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => onClose && onClose(id);

  const handleSearch = () => {
    setError(null);
    setResults([]);

    if (!window.writer?.editor) {
      setError(t('LW.xpathSearch.editorNotReady'));
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      const nodes = window.writer.utilities.evaluateXPathAll(
        window.writer.editor.getBody(),
        trimmed,
      );

      const items: XPathResultItem[] = nodes.map((node) => {
        const xpath = isElement(node)
          ? (window.writer.utilities.getElementXPath(node) ?? '')
          : (window.writer.utilities.getNodeXpath(node) ?? '');
        const id = isElement(node) ? node.getAttribute('id') ?? undefined : undefined;
        const tagName = isElement(node) ? node.getAttribute('_tag') ?? node.nodeName : node.nodeName;

        return {
          id,
          label: tagName,
          xpath,
        };
      });

      setResults(items);
      if (items.length === 0) {
        setError(t('LW.xpathSearch.noResults'));
      }
    } catch {
      setError(t('LW.xpathSearch.invalidXPath'));
    }
  };

  const handleSelect = (item: XPathResultItem) => {
    if (item.id) {
      window.writer.utilities.selectElementById(item.id);
      return;
    }
    if (item.xpath) {
      window.writer.utilities.selectNode({ xpath: item.xpath });
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" onClose={handleClose} open={open}>
      <DialogTitle>{t('LW.xpathSearch.title')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            label={t('LW.xpathSearch.queryLabel')}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearch();
            }}
            placeholder="TEI/text/body//p"
            size="small"
            value={query}
          />
          <Button onClick={handleSearch} variant="contained">
            {t('LW.xpathSearch.search')}
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
          {t('LW.xpathSearch.hint')}
        </Typography>
        {error && (
          <Typography color="error" sx={{ mb: 1 }} variant="body2">
            {error}
          </Typography>
        )}
        <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
          {results.map((item, index) => (
            <ListItemButton key={`${item.xpath}-${index}`} onClick={() => handleSelect(item)}>
              <ListItemText
                primary={item.label}
                secondary={item.xpath}
                secondaryTypographyProps={{ sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('LW.commons.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
