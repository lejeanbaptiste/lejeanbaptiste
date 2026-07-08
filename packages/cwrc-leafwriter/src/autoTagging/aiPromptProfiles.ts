import auditCleanSystemTemplate from './prompt-templates/audit-clean.system.txt';
import disambiguationRankSystemTemplate from './prompt-templates/disambiguation-rank.system.txt';
import suggestSystemTemplate from './prompt-templates/suggest.system.txt';
import validationSystemTemplate from './prompt-templates/validation.system.txt';
import { entityStoreFromDesktop } from './entityStore';
import { joinPath } from './pathJoin';

/** User-editable task wording only — preamble, tag guide, and JSON schema stay locked. */
export interface AiPromptProfile {
  id: string;
  label: string;
  /** Bumped when the user saves edits — part of the LLM cache key. */
  version: number;
  suggestTaskText: string;
  auditCleanTaskText: string;
  disambiguationRankTaskText: string;
  validationTaskText?: string;
}

export interface AiPromptProfilesState {
  activeProfileId: string;
  profiles: AiPromptProfile[];
}

export const AI_PROMPT_PROFILES_FILE = 'ai-prompt-profiles.json';
export const DEFAULT_AI_PROMPT_PROFILE_ID = 'default';

export const DEFAULT_SUGGEST_TASK_TEXT = suggestSystemTemplate.trimStart();
export const DEFAULT_AUDIT_CLEAN_TASK_TEXT = auditCleanSystemTemplate.trimStart();
export const DEFAULT_DISAMBIGUATION_RANK_TASK_TEXT = disambiguationRankSystemTemplate.trimStart();
export const DEFAULT_VALIDATION_TASK_TEXT = validationSystemTemplate.trimStart();

const FILE_FORMAT_VERSION = 1;

interface AiPromptProfilesFile {
  version: typeof FILE_FORMAT_VERSION;
  activeProfileId: string;
  profiles: AiPromptProfile[];
}

export function createDefaultAiPromptProfile(): AiPromptProfile {
  return {
    id: DEFAULT_AI_PROMPT_PROFILE_ID,
    label: 'Default',
    version: 0,
    suggestTaskText: DEFAULT_SUGGEST_TASK_TEXT,
    auditCleanTaskText: DEFAULT_AUDIT_CLEAN_TASK_TEXT,
    disambiguationRankTaskText: DEFAULT_DISAMBIGUATION_RANK_TASK_TEXT,
    validationTaskText: DEFAULT_VALIDATION_TASK_TEXT,
  };
}

export function createDefaultAiPromptProfilesState(): AiPromptProfilesState {
  const profile = createDefaultAiPromptProfile();
  return { activeProfileId: profile.id, profiles: [profile] };
}

export function aiPromptProfilesPath(ljbDir: string): string {
  return joinPath(ljbDir, AI_PROMPT_PROFILES_FILE);
}

export function getActiveAiPromptProfile(state: AiPromptProfilesState): AiPromptProfile {
  return (
    state.profiles.find((p) => p.id === state.activeProfileId) ??
    state.profiles[0] ??
    createDefaultAiPromptProfile()
  );
}

export function isDefaultAiPromptProfile(profile: AiPromptProfile): boolean {
  return (
    profile.suggestTaskText === DEFAULT_SUGGEST_TASK_TEXT &&
    profile.auditCleanTaskText === DEFAULT_AUDIT_CLEAN_TASK_TEXT &&
    profile.disambiguationRankTaskText === DEFAULT_DISAMBIGUATION_RANK_TASK_TEXT &&
    profile.validationTaskText === DEFAULT_VALIDATION_TASK_TEXT
  );
}

/** Shipped template text when profile matches defaults; otherwise the saved override. */
export function resolveSuggestTaskText(profile?: AiPromptProfile | null): string | undefined {
  if (!profile || isDefaultAiPromptProfile(profile)) return undefined;
  return profile.suggestTaskText;
}

export function resolveAuditCleanTaskText(profile?: AiPromptProfile | null): string | undefined {
  if (!profile || isDefaultAiPromptProfile(profile)) return undefined;
  return profile.auditCleanTaskText;
}

export function resolveDisambiguationRankTaskText(profile?: AiPromptProfile | null): string | undefined {
  if (!profile || isDefaultAiPromptProfile(profile)) return undefined;
  return profile.disambiguationRankTaskText;
}

export function resolveValidationTaskText(profile?: AiPromptProfile | null): string | undefined {
  if (!profile || isDefaultAiPromptProfile(profile)) return undefined;
  return profile.validationTaskText;
}

/** Append a profile suffix to the shipped prompt version for cache invalidation. */
export function promptVersionWithProfile(baseVersion: string, profile?: AiPromptProfile | null): string {
  if (!profile || (profile.id === DEFAULT_AI_PROMPT_PROFILE_ID && profile.version === 0)) {
    return baseVersion;
  }
  return `${baseVersion}+${profile.id}v${profile.version}`;
}

export function parseAiPromptProfilesFile(raw: string): AiPromptProfilesState {
  const parsed = JSON.parse(raw) as Partial<AiPromptProfilesFile>;
  if (parsed.version !== FILE_FORMAT_VERSION || !Array.isArray(parsed.profiles)) {
    return createDefaultAiPromptProfilesState();
  }

  const profiles = parsed.profiles
    .filter(
      (p): p is AiPromptProfile =>
        Boolean(p) &&
        typeof p.id === 'string' &&
        typeof p.label === 'string' &&
        typeof p.version === 'number' &&
        typeof p.suggestTaskText === 'string' &&
        typeof p.auditCleanTaskText === 'string',
    )
    .map((p) => ({
      ...p,
      version: Math.max(0, Math.floor(p.version)),
      disambiguationRankTaskText:
        typeof (p as Partial<AiPromptProfile>).disambiguationRankTaskText === 'string'
          ? (p as AiPromptProfile).disambiguationRankTaskText
          : DEFAULT_DISAMBIGUATION_RANK_TASK_TEXT,
    }));

  if (profiles.length === 0) return createDefaultAiPromptProfilesState();

  const hasDefault = profiles.some((p) => p.id === DEFAULT_AI_PROMPT_PROFILE_ID);
  const merged = hasDefault ? profiles : [createDefaultAiPromptProfile(), ...profiles];

  const activeProfileId = merged.some((p) => p.id === parsed.activeProfileId)
    ? parsed.activeProfileId!
    : merged[0]!.id;

  return { activeProfileId, profiles: merged };
}

export function serializeAiPromptProfilesFile(state: AiPromptProfilesState): string {
  const payload: AiPromptProfilesFile = {
    version: FILE_FORMAT_VERSION,
    activeProfileId: state.activeProfileId,
    profiles: state.profiles,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export async function readAiPromptProfilesFromDesktop(): Promise<AiPromptProfilesState> {
  const store = entityStoreFromDesktop();
  if (!store) return createDefaultAiPromptProfilesState();
  try {
    const raw = await store.readProjectLjbFile(AI_PROMPT_PROFILES_FILE);
    return raw ? parseAiPromptProfilesFile(raw) : createDefaultAiPromptProfilesState();
  } catch {
    return createDefaultAiPromptProfilesState();
  }
}

export async function persistAiPromptProfiles(state: AiPromptProfilesState): Promise<void> {
  const store = entityStoreFromDesktop();
  if (!store) return;
  await store.writeProjectLjbFile(AI_PROMPT_PROFILES_FILE, serializeAiPromptProfilesFile(state));
}

export function newAiPromptProfileId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function saveProfileEdits(
  state: AiPromptProfilesState,
  profileId: string,
  edits: Pick<
    AiPromptProfile,
    'label' | 'suggestTaskText' | 'auditCleanTaskText' | 'disambiguationRankTaskText'
  >,
): AiPromptProfilesState {
  const profiles = state.profiles.map((p) => {
    if (p.id !== profileId) return p;
    const unchanged =
      p.label === edits.label &&
      p.suggestTaskText === edits.suggestTaskText &&
      p.auditCleanTaskText === edits.auditCleanTaskText &&
      p.disambiguationRankTaskText === edits.disambiguationRankTaskText;
    return {
      ...p,
      ...edits,
      version: unchanged ? p.version : p.version + 1,
    };
  });
  return { ...state, profiles };
}

export function addNamedProfile(
  state: AiPromptProfilesState,
  label: string,
  source: AiPromptProfile,
): AiPromptProfilesState {
  const trimmed = label.trim();
  if (!trimmed) return state;
  const profile: AiPromptProfile = {
    id: newAiPromptProfileId(),
    label: trimmed,
    version: 1,
    suggestTaskText: source.suggestTaskText,
    auditCleanTaskText: source.auditCleanTaskText,
    disambiguationRankTaskText: source.disambiguationRankTaskText,
  };
  return {
    activeProfileId: profile.id,
    profiles: [...state.profiles, profile],
  };
}

export function deleteAiPromptProfile(
  state: AiPromptProfilesState,
  profileId: string,
): AiPromptProfilesState {
  if (profileId === DEFAULT_AI_PROMPT_PROFILE_ID) return state;
  const profiles = state.profiles.filter((p) => p.id !== profileId);
  if (profiles.length === state.profiles.length) return state;
  const activeProfileId =
    state.activeProfileId === profileId ? DEFAULT_AI_PROMPT_PROFILE_ID : state.activeProfileId;
  return { activeProfileId, profiles };
}

export function setActiveAiPromptProfile(
  state: AiPromptProfilesState,
  profileId: string,
): AiPromptProfilesState {
  if (!state.profiles.some((p) => p.id === profileId)) return state;
  return { ...state, activeProfileId: profileId };
}

export function revertProfileToDefaults(profile: AiPromptProfile): AiPromptProfile {
  return {
    ...profile,
    suggestTaskText: DEFAULT_SUGGEST_TASK_TEXT,
    auditCleanTaskText: DEFAULT_AUDIT_CLEAN_TASK_TEXT,
    disambiguationRankTaskText: DEFAULT_DISAMBIGUATION_RANK_TASK_TEXT,
    version: profile.version + 1,
  };
}
