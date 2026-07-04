import type { DisambiguationCandidate } from './disambiguationCandidates';
import type { MentionGroup, MentionInstance } from './mentions';

export interface DisambiguationFilters {
  tag: string | null;
  hideResolved: boolean;
}

export interface DisambiguationState {
  groups: MentionGroup[];
  filters: DisambiguationFilters;
  groupIndex: number;
  instanceIndex: number;
  selectedCandidateId: string | null;
  ignoredKeys: Set<string>;
}

export type DisambiguationScope = 'occurrence' | 'document-surface';

export interface DisambiguationDecision {
  scope: DisambiguationScope;
  group: MentionGroup;
  instance: MentionInstance;
  candidate?: DisambiguationCandidate;
  action: 'accept' | 'unresolved' | 'ignore' | 'create';
}

function groupKey(group: MentionGroup): string {
  return `${group.tag}\0${group.surface}`;
}

function visibleGroups(state: DisambiguationState): MentionGroup[] {
  return state.groups.filter((group) => {
    if (state.filters.hideResolved && group.fullyResolved) return false;
    if (state.filters.tag && group.tag !== state.filters.tag) return false;
    if (state.ignoredKeys.has(groupKey(group))) return false;
    return group.instances.some((instance) => !instance.hasKey);
  });
}

function pendingInstances(group: MentionGroup): MentionInstance[] {
  return group.instances.filter((instance) => !instance.hasKey);
}

export class DisambiguationController {
  private state: DisambiguationState;

  constructor(groups: MentionGroup[], filters: Partial<DisambiguationFilters> = {}) {
    this.state = {
      groups,
      filters: {
        tag: filters.tag ?? null,
        hideResolved: filters.hideResolved ?? true,
      },
      groupIndex: 0,
      instanceIndex: 0,
      selectedCandidateId: null,
      ignoredKeys: new Set(),
    };
    this.clampCursor();
  }

  get filters(): DisambiguationFilters {
    return this.state.filters;
  }

  visible(): MentionGroup[] {
    return visibleGroups(this.state);
  }

  currentGroup(): MentionGroup | null {
    return this.visible()[this.state.groupIndex] ?? null;
  }

  currentInstance(): MentionInstance | null {
    const group = this.currentGroup();
    if (!group) return null;
    return pendingInstances(group)[this.state.instanceIndex] ?? null;
  }

  selectedCandidateId(): string | null {
    return this.state.selectedCandidateId;
  }

  setSelectedCandidate(candidateId: string | null): void {
    this.state.selectedCandidateId = candidateId;
  }

  setFilters(filters: Partial<DisambiguationFilters>): void {
    this.state.filters = { ...this.state.filters, ...filters };
    this.clampCursor();
  }

  next(): void {
    const group = this.currentGroup();
    if (!group) return;
    const pending = pendingInstances(group);
    if (this.state.instanceIndex < pending.length - 1) {
      this.state.instanceIndex += 1;
      return;
    }
    if (this.state.groupIndex < this.visible().length - 1) {
      this.state.groupIndex += 1;
      this.state.instanceIndex = 0;
    }
  }

  previous(): void {
    if (this.state.instanceIndex > 0) {
      this.state.instanceIndex -= 1;
      return;
    }
    if (this.state.groupIndex > 0) {
      this.state.groupIndex -= 1;
      const group = this.currentGroup();
      this.state.instanceIndex = Math.max(0, (group ? pendingInstances(group).length : 1) - 1);
    }
  }

  ignoreCurrentGroup(): void {
    const group = this.currentGroup();
    if (!group) return;
    this.state.ignoredKeys.add(groupKey(group));
    this.clampCursor();
  }

  /** Split one instance into its own group (same tag/surface key but single instance). */
  splitCurrentInstance(): void {
    const group = this.currentGroup();
    const instance = this.currentInstance();
    if (!group || !instance) return;

    const remaining = group.instances.filter((item) => item !== instance);
    group.instances = remaining;
    group.fullyResolved = remaining.every((item) => item.hasKey);

    this.state.groups.push({
      tag: group.tag,
      surface: group.surface,
      instances: [instance],
      fullyResolved: false,
    });
    this.clampCursor();
  }

  private clampCursor(): void {
    const visible = this.visible();
    if (visible.length === 0) {
      this.state.groupIndex = 0;
      this.state.instanceIndex = 0;
      return;
    }
    this.state.groupIndex = Math.min(this.state.groupIndex, visible.length - 1);
    const pending = pendingInstances(visible[this.state.groupIndex]!);
    this.state.instanceIndex = Math.min(this.state.instanceIndex, Math.max(0, pending.length - 1));
  }
}
