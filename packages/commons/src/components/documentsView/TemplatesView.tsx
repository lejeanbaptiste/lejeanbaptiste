import { Divider, Stack, Typography, useTheme } from '@mui/material';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import React, { useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import Masonry from 'react-responsive-masonry';
import { useNavigate } from 'react-router';
import type { DisplayLayout } from '.';
import { CARD_WIDTH, DocumentCard } from './components';

interface TemplatesView {
  displayLayout?: DisplayLayout;
  onClose?: () => void;
  onSelect?: (template: Resource) => void;
  selected?: Resource;
  type?: 'singleClick' | 'doubleClick';
  width: number;
}
export const TemplatesView: FC<TemplatesView> = ({
  displayLayout = 'list',
  onClose,
  onSelect,
  selected,
  type = 'singleClick',
  width = 400,
}) => {
  const { setResource } = useActions().editor;
  const { getTemplates, loadSample } = useActions().storage;

  const { t } = useTranslation('commons');
  const navigate = useNavigate();
  const { spacing } = useTheme();

  const [templates, setTemplates] = useState<Resource[]>([]);

  const categories = new Set([...templates.map((template) => template.category)]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const documents = await getTemplates();
    setTemplates(documents);
  };

  const handleSelect = (value: Resource) => onSelect && onSelect(value);

  const handledSelectCreate = (value: Resource) => {
    onSelect && onSelect(value);
    onClose && onClose();
    load(value);
  };

  const load = async ({ title, url }: Resource) => {
    if (!url) return;
    const content = await loadSample(url);
    setResource({ content, filename: `${title}.xml` });
    navigate(`/edit?template=${title}`, { replace: true });
  };

  const gap = 12;
  const columns = displayLayout === 'grid' ? Math.floor((width - gap) / (CARD_WIDTH + gap)) : 1;
  const widthMasonry = columns * (CARD_WIDTH + gap);

  return (
    <Stack direction="column" pt={1} gap={1.5} width={width}>
      {[...categories.values()].map((category) => {
        return (
          <Category key={category} title={category ?? t('other')}>
            <Masonry
              columnsCount={columns}
              gutter={`${gap}px`}
              style={{
                marginInline: spacing(0.5),
                paddingTop: spacing(1.5),
                width: displayLayout === 'grid' ? widthMasonry : 'calc(100% - 24px)',
              }}
            >
              {templates
                .filter((resource) => resource.category === category)
                .map((resource) => (
                  <DocumentCard
                    key={resource.url}
                    displayLayout={displayLayout}
                    onClick={type === 'singleClick' ? load : handleSelect}
                    onDoubleClick={type === 'doubleClick' ? handledSelectCreate : undefined}
                    resource={resource}
                    selected={selected}
                  />
                ))}
            </Masonry>
          </Category>
        );
      })}
    </Stack>
  );
};

////***** CATEGORIES */

interface CategoryProps {
  children: React.ReactNode;
  title: string;
}

export const Category: FC<CategoryProps> = ({ children, title }) => {
  return (
    <Stack spacing={0.5} px={1} py={0.5}>
      <Typography
        fontWeight={700}
        letterSpacing=".15rem"
        textTransform="uppercase"
        variant="subtitle1"
        px={1}
      >
        {title}
      </Typography>
      <Divider />
      <Stack direction="row" flexWrap="wrap" gap={3}>
        {children}
      </Stack>
    </Stack>
  );
};
