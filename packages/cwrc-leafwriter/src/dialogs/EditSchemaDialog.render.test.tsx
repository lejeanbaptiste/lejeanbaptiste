import { EditSchemaDialog } from './EditSchemaDialog';
import { renderWithOvermind } from '../../test/renderWithOvermind';

/**
 * Render smoke test for the schema editor dialog. See
 * apps/commons/src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why
 * these exist.
 */

describe('EditSchemaDialog', () => {
  it('mounts in add mode', () => {
    expect(() =>
      renderWithOvermind(
        <EditSchemaDialog actionType="add" onAcceptChanges={jest.fn()} onClose={jest.fn()} open />,
      ),
    ).not.toThrow();
  });

  it('mounts closed', () => {
    expect(() =>
      renderWithOvermind(
        <EditSchemaDialog actionType="add" onAcceptChanges={jest.fn()} onClose={jest.fn()} />,
      ),
    ).not.toThrow();
  });
});
