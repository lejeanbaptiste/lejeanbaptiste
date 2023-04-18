import Masonry from '@mui/lab/Masonry';
import { Divider, Stack, Typography } from '@mui/material';
import { useOpenResource } from '@src/hooks';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Layout } from '.';
import { CARD_WIDTH, DocumentCard } from './components';

interface TemplatesView {
  layout?: Layout;
  onClose?: () => void;
  onLoad?: () => void;
  onSelect?: (template: Resource) => void;
  selected?: Resource;
  width: number;
}
export const TemplatesView = ({
  layout = 'list',
  onClose,
  onLoad,
  onSelect,
  selected,
  width = 400,
}: TemplatesView) => {
  const { getTemplates } = useActions().storage;

  const { t } = useTranslation('LWC');

  const { openFromLibrary } = useOpenResource();

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
    const { url } = resource;
    if (!url) return setItemSelected(null);
    if (itemSelected === url) return;

    setItemSelected(url);
    onSelect && onSelect(resource);
  };

  const handledSelectCreate = (resource: Resource) => {
    onSelect && onSelect(resource);
    onClose && onClose();
    load(resource);
  };

  const load = async ({ title }: Resource) => {
    if (!title) return;
    openFromLibrary({ category: 'template', title });
    onLoad && onLoad();
  };

  const gap = 12;
  const columns = layout === 'grid' ? Math.floor((width - gap) / (CARD_WIDTH + gap)) : 1;
  const widthMasonry = columns * (CARD_WIDTH + gap);

  return (
    <Stack direction="column" pt={1} gap={1.5} width={width}>
      {[...categories.values()].map((category) => {
        return (
          <Category key={category} title={category ?? t('commons.other')}>
            <Masonry
              columns={columns}
              spacing={1.5}
              sx={{
                width: layout === 'grid' ? widthMasonry : 'calc(100% - 32px)',
                mx: 1.5,
                pt: 1.5,
              }}
            >
              {templates
                .filter((resource) => resource.category === category)
                .map((resource) => (
                  <DocumentCard
                    key={resource.url}
                    layout={layout}
                    onClick={handleSelect}
                    onDoubleClick={handledSelectCreate}
                    selected={itemSelected === resource.url}
                    {...resource}
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
