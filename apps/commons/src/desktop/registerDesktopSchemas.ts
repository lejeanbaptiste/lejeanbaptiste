import type { Types } from '@cwrc/leafwriter';

/** Plain schema copy — commons Overmind proxies cannot be stored in LEAF-Writer's state tree. */
const detachSchema = (schema: Types.Schema): Types.Schema => ({
  css: [...schema.css],
  editable: schema.editable ?? true,
  id: schema.id,
  mapping: schema.mapping,
  name: schema.name,
  rng: [...schema.rng],
});

const upsertSchemaManagerEntry = (schema: Types.Schema) => {
  const index = window.writer!.schemaManager.schemas.findIndex(({ id }) => id === schema.id);
  if (index === -1) {
    window.writer!.schemaManager.schemas.push(schema);
    return;
  }
  window.writer!.schemaManager.schemas[index] = schema;
};

/** Register project-local schemas with the running editor (tab switch / re-open). */
export const registerDesktopSchemas = (schemas: Types.Schema[]) => {
  if (!window.writer || schemas.length === 0) return;

  const detached = schemas.map(detachSchema);
  for (const schema of detached) {
    upsertSchemaManagerEntry(schema);
  }

  const editorActions = window.writer.overmindActions?.editor;
  if (editorActions?.registerProjectSchemas) {
    editorActions.registerProjectSchemas(detached);
  }
};
