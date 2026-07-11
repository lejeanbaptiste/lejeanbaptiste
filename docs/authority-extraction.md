# Authority extraction (sibling repo)

Pack **build pipelines** (extract → compile → publish) live in the separate **`authority extraction`** workspace, not in this repo.

| Resource | Location |
|----------|----------|
| Master phases (all sources, human checkpoints) | [`authority extraction/docs/phases.md`](../../authority%20extraction/docs/phases.md) |
| Wikidata config + validator (W0 done) | [`authority extraction/wikidata/`](../../authority%20extraction/wikidata/) |
| Strategy & source research | [authority-packs-planning.md](authority-packs-planning.md) |
| Wikidata design detail | [wikidata-tag-packs-planning.md](wikidata-tag-packs-planning.md) |
| LJB download + tag bomb + lifecycle (tracks A0–A6) | [authority-databases-phases.md](authority-databases-phases.md) |
| Offline data lifecycle (enable/update/delete) | [authority-data-lifecycle.md](authority-data-lifecycle.md) |

Validate Wikidata tables from the extraction repo:

```bash
cd "../authority extraction"
npm run validate
```

Built packs are consumed by leaf-writer at `<entityDbFolder>/authority-packs/` (from the **GitHub `authoritypacks` repo**) and optionally `<entityDbFolder>/authority-databases/` (raw reference from official upstream). See [authority-data-lifecycle.md](authority-data-lifecycle.md).

**Distribution (2026-07-05):** GitHub Actions builds tagging packs; LJB downloads binaries from the `authoritypacks` repo. Raw CBDB/DILA for entity enrichment stays a separate user download from HuggingFace / DILA GitHub. Dev sync: `node scripts/sync-authority-packs.mjs <entityDbFolder>`.
