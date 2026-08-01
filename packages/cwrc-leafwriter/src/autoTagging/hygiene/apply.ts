import type { EntityStore } from '../entityStore';
import type { HygieneFinding } from './types';

/**
 * Apply one hygiene proposal via existing typed SQLite mutators.
 * Returns a short status message for the UI.
 */
export async function applyHygieneFinding(
  store: EntityStore,
  finding: HygieneFinding,
  options?: { keepId?: string },
): Promise<string> {
  const { proposal } = finding;
  switch (proposal.action) {
    case 'stripAltName': {
      await store.sqliteRemoveName(finding.entityId, proposal.fromText);
      await store.sqliteAddName({
        entityId: finding.entityId,
        text: proposal.toText,
        nameType: proposal.nameType,
        origin: 'user',
      });
      return `Stripped 姓 from ${proposal.nameType}: ${proposal.toText}`;
    }
    case 'setFamilyGiven': {
      await store.sqliteAddName({
        entityId: finding.entityId,
        text: proposal.familyName,
        nameType: 'family',
        origin: 'user',
      });
      await store.sqliteAddName({
        entityId: finding.entityId,
        text: proposal.givenName,
        nameType: 'given',
        origin: 'user',
      });
      if (proposal.romanizedName) {
        await store.sqliteSetRomanizedName(finding.entityId, proposal.romanizedName);
      }
      return `Set 姓 ${proposal.familyName} / 名 ${proposal.givenName}`;
    }
    case 'setRomanized': {
      await store.sqliteSetRomanizedName(finding.entityId, proposal.text);
      return `Romanization → ${proposal.text}`;
    }
    case 'renamePrimary': {
      await store.sqliteRenamePrimaryName(finding.entityId, proposal.text);
      return `Primary → ${proposal.text}`;
    }
    case 'setDescription': {
      if (!proposal.text.trim()) throw new Error('No description available to apply');
      await store.sqliteUpdateDescription(finding.entityId, proposal.text);
      return 'Description filled from authority';
    }
    case 'restoreName': {
      await store.sqliteValidateAssertion(finding.entityId, proposal.assertionKey);
      return `Restored name “${proposal.text}”`;
    }
    case 'merge': {
      const keepId = options?.keepId ?? proposal.keepId;
      const dropIds = (
        finding.relatedEntityIds ?? [
          finding.entityId,
          ...(finding.peer?.kind === 'entity' ? [finding.peer.entityId] : []),
        ]
      ).filter((id) => id !== keepId);
      const uniqueDrop = [
        ...new Set(dropIds.length ? dropIds : proposal.dropIds.filter((id) => id !== keepId)),
      ];
      if (uniqueDrop.length === 0) throw new Error('Nothing to merge');
      await store.sqliteMerge(keepId, uniqueDrop);
      return `Merged into ${keepId}`;
    }
    case 'markDuplicateIntentional': {
      await store.sqliteMarkDuplicateIntentional(proposal.entityIds);
      return 'Marked intentional duplicate';
    }
    case 'attachAuthority': {
      await store.sqliteAttachAuthority(
        finding.entityId,
        proposal.authorityType,
        proposal.authorityValue,
      );
      return `Linked ${proposal.authorityType}: ${proposal.authorityValue}`;
    }
    case 'ingestHarvest': {
      const result = await store.sqliteReconcileXmlExtractedData({
        documentKey: proposal.documentKey,
        wrappers: [
          {
            entityId: finding.entityId,
            source: proposal.source,
            assertions: proposal.assertions,
          },
        ],
        purgeOrphanSources: false,
      });
      return `Harvested ${result.added} fact${result.added === 1 ? '' : 's'} into ${finding.entityId}`;
    }
    default: {
      const _exhaustive: never = proposal;
      return _exhaustive;
    }
  }
}
