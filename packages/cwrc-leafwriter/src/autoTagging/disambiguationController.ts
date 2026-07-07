import type { DisambiguationCandidate } from './disambiguationCandidates';
import type { MentionGroup, MentionInstance } from './mentions';

export interface DisambiguationFilters {
  tag: string | null;
}

export interface DisambiguationState {
  groups: MentionGroup[];
  filters: DisambiguationFilters;
  /** Key of the group currently selected for editing / keyboard nav. */
  selectedGroupKey: string | null;
  instanceIndex: number;
  selectedCandidateId: string | null;
  ignoredKeys: Set<string>;
  expandedKeys: Set<string>;
}

export type DisambiguationScope = 'occurrence' | 'document-surface';

export interface DisambiguationDecision {
  scope: DisambiguationScope;
  group: MentionGroup;
  instance: MentionInstance;
  candidate?: DisambiguationCandidate;
  action: 'accept' | 'unresolved' | 'ignore' | 'create' | 'clear';
}

export interface DisambiguationControllerOptions {
  /** Called when the cursor moves to a mention — host jumps the editor there. */
  onFocus?: (instance: MentionInstance) => void;
}

export function mentionGroupKey(group: MentionGroup): string {
  return `${group.tag}\0${group.surface}`;
}

function matchesFilters(group: MentionGroup, filters: DisambiguationFilters): boolean {
  return !filters.tag || group.tag === filters.tag;
}

function isIgnored(state: DisambiguationState, group: MentionGroup): boolean {
  return state.ignoredKeys.has(mentionGroupKey(group));
}

export function pendingInstances(group: MentionGroup): MentionInstance[] {
  return group.instances.filter((instance) => !instance.hasKey);
}

export function syncMentionInstanceFromElement(instance: MentionInstance): void {
  const key = instance.element.getAttribute('key')?.trim() ?? '';
  const cert = instance.element.getAttribute('cert')?.trim() ?? '';
  instance.hasKey = key.length > 0;
  instance.isUnresolved = cert === 'unknown' && !instance.hasKey;
}

export function syncMentionGroupFromElements(group: MentionGroup): void {
  for (const instance of group.instances) syncMentionInstanceFromElement(instance);
  group.fullyResolved = group.instances.every((item) => item.hasKey);
}

function filteredGroups(state: DisambiguationState): MentionGroup[] {
  return state.groups.filter(
    (group) => matchesFilters(group, state.filters) && !isIgnored(state, group),
  );
}

function pendingGroups(state: DisambiguationState): MentionGroup[] {
  return filteredGroups(state).filter((group) => pendingInstances(group).length > 0);
}

function resolvedGroups(state: DisambiguationState): MentionGroup[] {
  return filteredGroups(state).filter((group) => group.fullyResolved);
}

function activeInstances(group: MentionGroup): MentionInstance[] {
  const pending = pendingInstances(group);
  return pending.length > 0 ? pending : group.instances;
}

function findGroup(state: DisambiguationState, key: string): MentionGroup | undefined {
  return state.groups.find((group) => mentionGroupKey(group) === key);
}

export class DisambiguationController {
  private state: DisambiguationState;
  private readonly options: DisambiguationControllerOptions;

  constructor(
    groups: MentionGroup[],
    filters: Partial<DisambiguationFilters> = {},
    options: DisambiguationControllerOptions = {},
  ) {
    this.options = options;
    this.state = {
      groups,
      filters: { tag: filters.tag ?? null },
      selectedGroupKey: null,
      instanceIndex: 0,
      selectedCandidateId: null,
      ignoredKeys: new Set(),
      expandedKeys: new Set(),
    };
    this.clampCursor();
    const first = pendingGroups(this.state)[0];
    if (first) this.selectGroup(mentionGroupKey(first), { focus: true, expand: true });
  }

  get filters(): DisambiguationFilters {
    return this.state.filters;
  }

  setGroups(groups: MentionGroup[]): void {
    this.state.groups = groups;
    for (const group of groups) syncMentionGroupFromElements(group);
    this.clampCursor();
  }

  /** @deprecated Use {@link pendingGroups} — kept for callers expecting the old name. */
  visible(): MentionGroup[] {
    return pendingGroups(this.state);
  }

  pendingGroups(): MentionGroup[] {
    return pendingGroups(this.state);
  }

  resolvedGroups(): MentionGroup[] {
    return resolvedGroups(this.state);
  }

  counts() {
    const pending = pendingGroups(this.state);
    const resolved = resolvedGroups(this.state);
    return {
      total: filteredGroups(this.state).length,
      pending: pending.length,
      resolved: resolved.length,
      ignored: this.state.ignoredKeys.size,
    };
  }

  currentGroup(): MentionGroup | null {
    if (!this.state.selectedGroupKey) return null;
    return findGroup(this.state, this.state.selectedGroupKey) ?? null;
  }

  currentInstance(): MentionInstance | null {
    const group = this.currentGroup();
    if (!group) return null;
    const instances = activeInstances(group);
    return instances[this.state.instanceIndex] ?? null;
  }

  selectedCandidateId(): string | null {
    return this.state.selectedCandidateId;
  }

  setSelectedCandidate(candidateId: string | null): void {
    this.state.selectedCandidateId = candidateId;
  }

  isExpanded(group: MentionGroup): boolean {
    return this.state.expandedKeys.has(mentionGroupKey(group));
  }

  toggleExpanded(group: MentionGroup): void {
    const key = mentionGroupKey(group);
    if (this.state.expandedKeys.has(key)) this.state.expandedKeys.delete(key);
    else this.state.expandedKeys.add(key);
  }

  setExpanded(group: MentionGroup, expanded: boolean): void {
    const key = mentionGroupKey(group);
    if (expanded) this.state.expandedKeys.add(key);
    else this.state.expandedKeys.delete(key);
  }

  setFilters(filters: Partial<DisambiguationFilters>): void {
    this.state.filters = { ...this.state.filters, ...filters };
    this.clampCursor();
  }

  selectGroup(
    key: string,
    options: { focus?: boolean; expand?: boolean; instanceIndex?: number } = {},
  ): void {
    const group = findGroup(this.state, key);
    if (!group) return;
    this.state.selectedGroupKey = key;
    if (options.expand) this.state.expandedKeys.add(key);
    const instances = activeInstances(group);
    this.state.instanceIndex =
      options.instanceIndex === undefined
        ? Math.min(this.state.instanceIndex, Math.max(0, instances.length - 1))
        : Math.min(Math.max(options.instanceIndex, 0), Math.max(0, instances.length - 1));
    if (options.focus !== false) {
      const instance = instances[this.state.instanceIndex];
      if (instance) this.options.onFocus?.(instance);
    }
  }

  selectInstance(group: MentionGroup, instanceIndex: number): void {
    this.selectGroup(mentionGroupKey(group), { focus: true, expand: true, instanceIndex });
  }

  preview(instance: MentionInstance): void {
    this.options.onFocus?.(instance);
  }

  next(): void {
    const pending = pendingGroups(this.state);
    if (pending.length === 0) return;

    const currentKey = this.state.selectedGroupKey;
    const groupIndex = pending.findIndex((group) => mentionGroupKey(group) === currentKey);
    const group = groupIndex >= 0 ? pending[groupIndex]! : pending[0]!;
    const instances = pendingInstances(group);
    const at = groupIndex >= 0 ? groupIndex : 0;

    if (this.state.instanceIndex < instances.length - 1) {
      this.selectGroup(mentionGroupKey(group), {
        focus: true,
        expand: true,
        instanceIndex: this.state.instanceIndex + 1,
      });
      return;
    }

    if (at < pending.length - 1) {
      const nextGroup = pending[at + 1]!;
      this.selectGroup(mentionGroupKey(nextGroup), { focus: true, expand: true, instanceIndex: 0 });
    }
  }

  previous(): void {
    const pending = pendingGroups(this.state);
    if (pending.length === 0) return;

    const currentKey = this.state.selectedGroupKey;
    const groupIndex = pending.findIndex((group) => mentionGroupKey(group) === currentKey);
    const group = groupIndex >= 0 ? pending[groupIndex]! : pending[0]!;
    const at = groupIndex >= 0 ? groupIndex : 0;

    if (this.state.instanceIndex > 0) {
      this.selectGroup(mentionGroupKey(group), {
        focus: true,
        expand: true,
        instanceIndex: this.state.instanceIndex - 1,
      });
      return;
    }

    if (at > 0) {
      const prevGroup = pending[at - 1]!;
      const prevInstances = pendingInstances(prevGroup);
      this.selectGroup(mentionGroupKey(prevGroup), {
        focus: true,
        expand: true,
        instanceIndex: Math.max(0, prevInstances.length - 1),
      });
    }
  }

  ignoreCurrentGroup(): void {
    const group = this.currentGroup();
    if (!group) return;
    this.state.ignoredKeys.add(mentionGroupKey(group));
    this.clampCursor();
  }

  /** Split one instance into its own group (same tag/surface key but single instance). */
  splitCurrentInstance(): void {
    const group = this.currentGroup();
    const instance = this.currentInstance();
    if (!group || !instance) return;

    const remaining = group.instances.filter((item) => item !== instance);
    group.instances = remaining;
    syncMentionGroupFromElements(group);

    const splitGroup: MentionGroup = {
      tag: group.tag,
      surface: group.surface,
      instances: [instance],
      fullyResolved: false,
    };
    this.state.groups.push(splitGroup);
    this.selectGroup(mentionGroupKey(splitGroup), { focus: true, expand: true, instanceIndex: 0 });
  }

  afterInstanceChange(group: MentionGroup): void {
    syncMentionGroupFromElements(group);
    const key = mentionGroupKey(group);
    if (pendingInstances(group).length === 0) {
      this.state.expandedKeys.add(key);
    }
    this.clampCursor();
  }

  private clampCursor(): void {
    const pending = pendingGroups(this.state);
    if (pending.length === 0) {
      if (this.state.selectedGroupKey) {
        const selected = findGroup(this.state, this.state.selectedGroupKey);
        if (selected && selected.fullyResolved) {
          const instances = activeInstances(selected);
          this.state.instanceIndex = Math.min(
            this.state.instanceIndex,
            Math.max(0, instances.length - 1),
          );
          return;
        }
      }
      this.state.selectedGroupKey = null;
      this.state.instanceIndex = 0;
      return;
    }

    const current = this.state.selectedGroupKey;
    const stillPending = current && pending.some((group) => mentionGroupKey(group) === current);
    if (!stillPending) {
      const first = pending[0]!;
      this.state.selectedGroupKey = mentionGroupKey(first);
      this.state.instanceIndex = 0;
      this.state.expandedKeys.add(mentionGroupKey(first));
      return;
    }

    const group = findGroup(this.state, this.state.selectedGroupKey!)!;
    const instances = activeInstances(group);
    this.state.instanceIndex = Math.min(
      this.state.instanceIndex,
      Math.max(0, instances.length - 1),
    );
  }
}

export interface DisambiguationKeyModifiers {
  shift?: boolean;
}

/** j/k navigate pending groups · Enter accepts current (handled by panel). */
export function handleDisambiguationKey(
  controller: DisambiguationController,
  key: string,
  _modifiers: DisambiguationKeyModifiers = {},
): boolean {
  switch (key) {
    case 'j':
    case 'ArrowDown':
      controller.next();
      return true;
    case 'k':
    case 'ArrowUp':
      controller.previous();
      return true;
    default:
      return false;
  }
}
