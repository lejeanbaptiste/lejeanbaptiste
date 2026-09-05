import { UniformAvatar } from './UniformAvatar';
import { render } from '@testing-library/react';

/**
 * Render smoke test for the player-avatar compositor — at ~1,180 lines the
 * largest component in commons. See
 * src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why these exist.
 *
 * Rendered with no ribbons or medals: the point is that the layout maths and
 * asset wiring run at all, not that any particular decoration appears.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

const baseProps = {
  serviceRibbons: [],
  medals: [],
  headImageUrl: 'grognard-asset://head.svg',
  bodyBackImageUrl: 'grognard-asset://back.svg',
  bodyFrontImageUrl: 'grognard-asset://front.svg',
  backgroundImageKey: 'bg-01',
};

describe('UniformAvatar', () => {
  it('mounts with no decorations', () => {
    expect(() => render(<UniformAvatar {...baseProps} />)).not.toThrow();
  });

  it('mounts with the alignment grid shown', () => {
    expect(() => render(<UniformAvatar {...baseProps} showAlignmentGrid />)).not.toThrow();
  });
});
