import type { Types } from '@cwrc/leafwriter';

/** Register project-local schemas with the running editor (tab switch / re-open). */
export const registerDesktopSchemas = (schemas: Types.Schema[]) => {
  if (!window.writer || schemas.length === 0) return;

  for (const schema of schemas) {
    const known = window.writer.schemaManager.schemas.some(({ id }) => id === schema.id);
    if (!known) {
      window.writer.schemaManager.schemas.push(schema);
    }

    const editorState = window.writer.overmindState?.editor as
      | { schemas: Record<string, Types.Schema> }
      | undefined;
    if (editorState && !editorState.schemas[schema.id]) {
      editorState.schemas = { ...editorState.schemas, [schema.id]: schema };
    }
  }
};
