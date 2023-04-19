import { List, ListItem, ListItemButton, ListItemText, useTheme } from '@mui/material';
import { useAtom, useAtomValue } from 'jotai';
import React from 'react';
import { isProcessingAtom, conversionTypesAtom, selectedTypeAtom } from '../store';

export const Sidebar = () => {
  const { palette } = useTheme();

  const conversionTypes = useAtomValue(conversionTypesAtom);
  const isProcessing = useAtomValue(isProcessingAtom);
  const [selectedType, setSelectedType] = useAtom(selectedTypeAtom);

  const handleClick = (value: string) => setSelectedType(value);

  return (
    <List sx={{ width: 200 }}>
      {conversionTypes.map((fileType) => (
        <ListItem key={fileType} disablePadding>
          <ListItemButton
            disabled={isProcessing}
            onClick={() => handleClick(fileType)}
            selected={selectedType === fileType}
            sx={{ py: 0.5, borderRadius: 1 }}
          >
            <ListItemText
              primary={fileType.toLowerCase()}
              sx={{
                span: {
                  color: selectedType === fileType ? palette.primary.light : 'inherit',
                  textTransform: 'capitalize',
                },
              }}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};
