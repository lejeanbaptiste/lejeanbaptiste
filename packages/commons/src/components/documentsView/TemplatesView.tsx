import Masonry from '@mui/lab/Masonry';
import { Divider, Stack, Typography } from '@mui/material';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
export const TemplatesView = ({
  displayLayout = 'list',
  onClose,
  onSelect,
  selected,
  type = 'singleClick',
  width = 400,
}: TemplatesView) => {
  const { setResource } = useActions().editor;
  const { getTemplates, loadSample } = useActions().storage;

  const { t } = useTranslation('commons');
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<Resource[]>([]);
  const [itemSelected, setItemSelected] = useState<string | null>(null);

  const categories = new Set([...templates.map((template) => template.category)]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const documents = await getTemplates();
    setTemplates(documents);
  };

  const handleSelect = (resource: Resource) => {
    if (!resource.url) return setItemSelected(null);
    setItemSelected(resource.url);
    
    onSelect && onSelect(resource);
  };

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
              columns={columns}
              spacing={1.5}
              sx={{
                width: displayLayout === 'grid' ? widthMasonry : 'calc(100% - 32px)',
                mx: 1.5,
                pt: 1.5,
              }}
            >
              {templates
                .filter((resource) => resource.category === category)
                .map((resource) => (
                  <DocumentCard
                    key={resource.url}
                    displayLayout={displayLayout}
                    // onClick={type === 'singleClick' ? load : handleSelect}
                    onClick={handleSelect}
                    onDoubleClick={type === 'doubleClick' ? handledSelectCreate : undefined}
                    resource={resource}
                    selected={itemSelected === resource.url}
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

export const Category = ({ children, title }: CategoryProps) => {
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
