import {
  DisambiguationController,
  mentionGroupKey,
  pendingInstances,
  syncMentionGroupFromElements,
} from './disambiguationController';
import type { MentionGroup, MentionInstance } from './mentions';

function mockInstance(hasKey: boolean, surface = '李白'): MentionInstance {
  const element = document.createElement('persName');
  if (hasKey) element.setAttribute('key', 'person-001');
  return {
    documentId: 'doc-1',
    tag: 'persName',
    surface,
    element,
    anchor: {
      documentId: 'doc-1',
      surface,
      occurrence: 1,
      nodeHash: 'abc',
      contextBefore: 'see ',
      contextAfter: ' here',
    },
    hasKey,
    isUnresolved: !hasKey,
  };
}

function mockGroup(
  surface: string,
  instances: MentionInstance[],
  tag = 'persName',
): MentionGroup {
  return {
    tag,
    surface,
    instances,
    fullyResolved: instances.every((item) => item.hasKey),
  };
}

describe('DisambiguationController', () => {
  it('lists pending and resolved groups separately', () => {
    const groups = [
      mockGroup('李白', [mockInstance(false)]),
      mockGroup('杜甫', [mockInstance(true)]),
    ];
    const controller = new DisambiguationController(groups, {}, { onFocus: jest.fn() });
    expect(controller.pendingGroups()).toHaveLength(1);
    expect(controller.resolvedGroups()).toHaveLength(1);
    expect(controller.counts()).toMatchObject({ pending: 1, resolved: 1 });
  });

  it('navigates pending instances with next/previous', () => {
    const groups = [
      mockGroup('李白', [mockInstance(false), mockInstance(false)]),
      mockGroup('杜甫', [mockInstance(false)]),
    ];
    const focused: string[] = [];
    const controller = new DisambiguationController(groups, {}, {
      onFocus: (instance) => focused.push(instance.surface),
    });

    expect(controller.currentGroup()?.surface).toBe('李白');
    controller.next();
    expect(controller.currentInstance()).toBe(groups[0]!.instances[1]);
    controller.next();
    expect(controller.currentGroup()?.surface).toBe('杜甫');
    controller.previous();
    expect(controller.currentInstance()).toBe(groups[0]!.instances[1]);
    expect(focused.length).toBeGreaterThan(0);
  });

  it('syncs hasKey from DOM after resolution', () => {
    const instance = mockInstance(false);
    const group = mockGroup('李白', [instance]);
    instance.element.setAttribute('key', 'person-002');
    syncMentionGroupFromElements(group);
    expect(instance.hasKey).toBe(true);
    expect(group.fullyResolved).toBe(true);
    expect(pendingInstances(group)).toHaveLength(0);
  });

  it('tracks expanded groups', () => {
    const group = mockGroup('李白', [mockInstance(false)]);
    const controller = new DisambiguationController([group], {}, { onFocus: jest.fn() });
    expect(controller.isExpanded(group)).toBe(true);
    controller.toggleExpanded(group);
    expect(controller.isExpanded(group)).toBe(false);
  });

  it('selects resolved groups for review', () => {
    const group = mockGroup('杜甫', [mockInstance(true)]);
    const controller = new DisambiguationController([group], {}, { onFocus: jest.fn() });
    controller.selectGroup(mentionGroupKey(group), { focus: true, expand: true });
    expect(controller.currentGroup()?.surface).toBe('杜甫');
    expect(controller.currentInstance()?.hasKey).toBe(true);
  });
});
