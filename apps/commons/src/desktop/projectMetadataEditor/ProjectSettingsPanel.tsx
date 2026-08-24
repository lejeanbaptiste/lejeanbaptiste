import { useMemo } from 'react';
import { ProjectMetadataForm } from './ProjectMetadataForm';
import { createEmbeddedProjectMetadataIO } from './io';

/**
 * The "Project" tab of the editor's settings dialog.
 *
 * Lives here rather than in `@cwrc/leafwriter` because everything it is built
 * on — the metadata form, the embedded IO adapter, `window.__leafWriterProject`
 * — is commons-owned and desktop-only. The settings dialog renders it through
 * `registerProjectSettingsPanel`, so the package never imports the app.
 */
export const ProjectSettingsPanel = ({ active = true }: { active?: boolean }) => {
  const projectFilePath = window.__leafWriterProject?.getProjectFilePath?.() ?? null;
  const io = useMemo(
    () => (projectFilePath ? createEmbeddedProjectMetadataIO(projectFilePath, 'edition') : null),
    [projectFilePath],
  );

  if (!projectFilePath || !io) return null;

  return <ProjectMetadataForm active={active} io={io} layout="panel" />;
};
