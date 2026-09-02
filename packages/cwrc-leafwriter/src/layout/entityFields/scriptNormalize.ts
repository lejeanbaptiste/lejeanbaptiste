/**
 * Normalize Han characters for the companion target script (Hans / shinjitai).
 * Uses OpenCC when the East Asian script pack is installed via asset onboarding.
 */

import { chineseNameOf } from './entityDisplay';
import type { EntitySummary } from './entitySummary';
import { normalizeSurfaceWithOpencc } from './openccScriptNormalize';

export {
  installScriptNormalization,
  isScriptNormalizationInstalled,
  warmOpenccConverters,
} from './openccScriptNormalize';

export const normalizeSurfaceForTargetLang = (
  surface: string,
  targetLang: string | null | undefined,
): string => normalizeSurfaceWithOpencc(surface, targetLang);

export const familyHanForEntity = (
  entity: Pick<EntitySummary, 'familyName' | 'names'>,
): string | null => {
  const fromNames = entity.names.find(
    (n) =>
      (n.role === 'family' || n.type === 'family' || n.type === 'familyName') &&
      /[\u3400-\u9FFF]/.test(n.text ?? ''),
  )?.text;
  if (fromNames?.trim()) return fromNames.trim();

  const chinese = chineseNameOf(entity as EntitySummary);
  if (chinese && chinese.length >= 2) return chinese[0] ?? null;
  return null;
};
