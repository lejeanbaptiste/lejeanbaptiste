import { Box } from '@mui/material';
import { useActions } from '@src/overmind';
import type { ISample } from '@src/types';
import React, { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router';
import { SampleFileCard } from './SampleFileCard';

interface SamplesViewProps {
  height?: number;
}

export const SamplesView: FC<SamplesViewProps> = () => {
  const { getSampleDocuments, loadSample, setResource } = useActions().storage;

  const navigate = useNavigate();

  const [samples, setSamples] = useState<ISample[]>([]);

  useEffect(() => {
    loadSamples();
  }, []);

  const loadSamples = async () => {
    const documents = await getSampleDocuments();
    setSamples(documents);
  };

  const load = async ({ title, url }: ISample) => {
    const content = await loadSample(url);
    setResource({ content, filename: `${title}.xml` });
    navigate(`/edit?sample=${title}`, { replace: true });
  };

  return (
    <>
      {samples.map((resource) => (
        <SampleFileCard key={resource.url} resource={resource} onClick={load} />
      ))}
    </>
  );
};
