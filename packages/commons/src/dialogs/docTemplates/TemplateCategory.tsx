import { Box, Button, Divider, Icon, Stack, Typography } from '@mui/material';
import { type IDocTemplate } from '@src/types';
import { getIcon } from '@src/utilities';
import React, { type FC } from 'react';

interface ITemplateCategory {
  category: string;
  onSelect: (value: IDocTemplate) => void;
  onDoubleClick: (value: IDocTemplate) => void;
  selected: IDocTemplate | null;
  templates: IDocTemplate[];
}

export const TemplateCategory: FC<ITemplateCategory> = ({
  category,
  onSelect,
  onDoubleClick,
  selected,
  templates,
}) => {
  return (
    <Stack key={category} direction="row" spacing={3}>
      <Box minWidth={100}>
        <Typography
          mt={0.25}
          textAlign="end"
          fontWeight={700}
          letterSpacing=".15rem"
          textTransform="uppercase"
          variant="subtitle1"
        >
          {category}
        </Typography>
      </Box>
      <Divider
        flexItem
        orientation={'vertical'}
        sx={{
          borderColor: '#999',
          boxShadow: '2px 0px 2px 0px rgb(0 0 0 / 15%)',
        }}
      />
      <Stack direction="row" flexWrap="wrap" gap={3}>
        {templates
          .filter((template) => template.category === category)
          .map((template) => (
            <Button
              key={template.url}
              disableElevation
              onClick={() => onSelect(template)}
              onDoubleClick={() => onDoubleClick(template)}
              size="small"
              startIcon={
                <Icon component={getIcon(template.icon ?? 'blankPage')} fontSize="inherit" />
              }
              sx={{ px: 1 }}
              variant={selected?.url === template.url ? 'contained' : 'text'}
            >
              {template.title}
            </Button>
          ))}
      </Stack>
    </Stack>
  );
};
