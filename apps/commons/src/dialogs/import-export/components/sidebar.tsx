import { List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { useAtom, useAtomValue } from 'jotai';
import { conversionTypesAtom, isProcessingAtom, selectedTypeAtom } from '../store';

export const Sidebar = () => {
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
            onPointerDown={() => handleClick(fileType)}
            selected={selectedType === fileType}
            sx={{ py: 0.5, borderRadius: 1 }}
          >
            <ListItemText
              primary={fileType.toLowerCase()}
              sx={[
                { span: { textTransform: 'capitalize' } },
                selectedType === fileType && {
                  span: { color: (theme) => theme.vars.palette.primary.light },
                },
              ]}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};
