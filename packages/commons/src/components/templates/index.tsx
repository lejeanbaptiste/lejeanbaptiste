import { Box } from '@mui/material';
import { useActions } from '@src/overmind';
import type { ISample } from '@src/types';
import React, { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router';
import { Category } from './Category';
import { TemplateCard } from './TemplateCard';

interface TemplatesView {
  onClose?: () => void;
  onSelect?: (template: ISample) => void;
  selected?: ISample;
  type?: 'singleClick' | 'doubleClick';
}

export const TemplatesView: FC<TemplatesView> = ({
  onClose,
  onSelect,
  selected,
  type = 'singleClick',
}) => {
  const { getTemplates, loadSample, setResource } = useActions().storage;

  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ISample[]>([]);

  const categories = new Set([...templates.map((template) => template.category)]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const documents = await getTemplates();
    setTemplates(documents);
  };

  const handleSelect = (value: ISample) => onSelect && onSelect(value);

  const handledSelectCreate = (value: ISample) => {
    onSelect && onSelect(value);
    onClose && onClose();
    load(value);
  };

  const load = async ({ title, url }: ISample) => {
    const content = await loadSample(url);
    setResource({ content, filename: `${title}.xml` });
    navigate(`/edit?template=${title}`, { replace: true });
  };

  return (
    <Box px={2}>
      {[...categories.values()].map((category) => (
        <Category key={category} title={category}>
          {templates
            .filter((template) => template.category === category)
            .map((template) => (
              <TemplateCard
                key={template.url}
                onClick={type === 'singleClick' ? load : handleSelect}
                onDoubleClick={type === 'doubleClick' ? handledSelectCreate : undefined}
                selected={selected}
                template={template}
              />
            ))}
        </Category>
      ))}
    </Box>
  );
};
