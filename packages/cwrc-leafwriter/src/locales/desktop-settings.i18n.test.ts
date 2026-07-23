import en from './en.json';
import fr from './fr.json';

const requiredKeys = [
  'achievements_storage',
  'achievements_storage_folder',
  'achievements_storage_default',
  'achievements_storage_change',
  'achievements_storage_hint',
  'achievements_import',
  'achievements_import_hint',
  'entity_database',
  'entity_database_change',
  'entity_database_folder',
  'entity_database_hint',
  'entity_database_missing',
  'entity_database_move',
  'entity_database_move_hint',
  'entity_database_move_success',
  'entity_database_move_error',
  'entity_database_reveal',
  'remember_workspace_on_startup',
  'user_name',
  'your_name',
] as const;

describe('desktop settings locale keys', () => {
  test.each([
    ['en', en],
    ['fr', fr],
  ])('keeps desktop settings strings in %s', (_locale, resource) => {
    for (const key of requiredKeys) {
      const value = resource.LW.desktop.settings[key];
      expect(value).toEqual(expect.any(String));
      expect(value.trim()).not.toBe('');
    }
  });
});
