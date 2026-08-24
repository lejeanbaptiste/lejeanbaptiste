import {
  clearAllPluginExtensions,
  clearPluginExtensionsForPlugin,
  getPluginTagCommandItems,
  getPluginToolbarItems,
  registerPluginTagCommandItem,
  registerPluginToolbarItem,
} from './pluginExtensions';

describe('plugin toolbar contributions — menu items', () => {
  afterEach(() => clearAllPluginExtensions());

  it('accepts a menu contribution with no top-level onClick', () => {
    const tagNobleTitle = jest.fn();
    registerPluginToolbarItem({
      pluginId: 'norbert',
      id: 'norbert-menu',
      icon: 'date',
      title: 'Norbert',
      isAvailable: () => true,
      menuItems: [{ id: 'tag-noble-title', label: 'Tag noble title', onClick: tagNobleTitle }],
    });

    const [item] = getPluginToolbarItems();
    expect(item!.onClick).toBeUndefined();
    expect(item!.menuItems).toHaveLength(1);
    item!.menuItems![0]!.onClick({ openCalendar: () => undefined });
    expect(tagNobleTitle).toHaveBeenCalledWith({ openCalendar: expect.any(Function) });
  });

  it('still accepts a plain single-action contribution (no menuItems)', () => {
    const onClick = jest.fn();
    registerPluginToolbarItem({
      pluginId: 'cjk-dates',
      id: 'calendar',
      icon: 'date',
      title: 'Calendar',
      isAvailable: () => true,
      onClick,
    });

    const [item] = getPluginToolbarItems();
    expect(item!.menuItems).toBeUndefined();
    item!.onClick!({ openCalendar: () => undefined });
    expect(onClick).toHaveBeenCalled();
  });
});

describe('plugin tag-command contributions', () => {
  afterEach(() => clearAllPluginExtensions());

  it('exposes only available items and removes them when the plugin is disabled', () => {
    registerPluginTagCommandItem({
      id: 'norbert:noble-title',
      label: 'Tag noble title',
      icon: 'norbert',
      onClick: () => undefined,
    });
    registerPluginTagCommandItem({
      id: 'norbert:person-wrapper',
      label: 'Tag person wrapper',
      icon: 'norbert',
      onClick: () => undefined,
      isAvailable: () => false,
    });

    expect(getPluginTagCommandItems().map((item) => item.id)).toEqual(['norbert:noble-title']);
    clearPluginExtensionsForPlugin('norbert');
    expect(getPluginTagCommandItems()).toEqual([]);
  });
});
