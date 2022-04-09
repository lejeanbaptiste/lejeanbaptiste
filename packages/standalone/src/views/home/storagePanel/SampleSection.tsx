import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

const SampleSection: FC = () => {
  const navigate = useNavigate();
  const { sampleDocuments } = useAppState();
  const { loadTemplate, setResource, setSampleUser } = useActions();
  const { t } = useTranslation();

  const handleClick = async (url: string) => {
    const documentString = await loadTemplate(url);
    setResource({ content: documentString });
    setSampleUser();
    navigate('/edit', { replace: true });
  };

  return (
    <Stack justifyContent="center" alignItems="stretch" spacing={2}>
      <Typography align="center" component="h6" variant="subtitle1" mr={3}>
        {t('home:orTrySample')}
      </Typography>
      <Paper>
        <List dense disablePadding>
          {sampleDocuments?.map(({ title, url }) => (
            <ListItem disablePadding key={title} dense divider>
              <ListItemButton onClick={() => handleClick(url)}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <ArticleOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={title} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Stack>
  );
};

export default SampleSection;
