import { useMemo } from 'react';
import { ProjectMetadataForm } from '../../../../../apps/commons/src/desktop/projectMetadataEditor/ProjectMetadataForm';
import { createEmbeddedProjectMetadataIO } from '../../../../../apps/commons/src/desktop/projectMetadataEditor/io';

export const ProjectSettingsPanel = ({ active = true }: { active?: boolean }) => {
  const projectFilePath = window.__leafWriterProject?.getProjectFilePath?.() ?? null;
  const io = useMemo(
    () => (projectFilePath ? createEmbeddedProjectMetadataIO(projectFilePath, 'edition') : null),
    [projectFilePath],
  );

  if (!projectFilePath || !io) return null;

  return <ProjectMetadataForm active={active} io={io} layout="panel" />;
};
