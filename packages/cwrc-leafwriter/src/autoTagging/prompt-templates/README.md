# LLM prompt templates (auto-tagging Phase 5)

Plain-text templates for **suggest** and **audit** producers. Edit these files directly — no TypeScript rebuild required for wording changes (webpack hot reload in dev).

## Files

| File | Role |
|------|------|
| `preamble.txt` | Shared rules (locator, JSON output, no offsets) |
| `suggest.system.txt` | Suggest task body; placeholders `{{TAGS}}`, `{{TAG_GUIDE}}` |
| `audit.system.txt` | Audit task body; placeholder `{{TAGS}}` |
| `user.wrapper.txt` | User message wrapper; `{{BEFORE}}`, `{{CHUNK}}`, `{{AFTER}}` |
| `tag-definitions.json` | One-line definition per tag name (used in suggest only) |
| `versions.json` | Bump `suggest` / `audit` when prompt *meaning* changes (invalidates LLM cache) |

Assembly logic lives in `../prompts.ts`.

## Planned UI (immediate future)

Developers can edit these files directly today. **Next build:** prompt profiles in the app so users can tune suggest text per model/corpus without touching the repo.

- **Storage (proposed):** `.ljb/ai-prompt-profiles.json` per project, optional app-level defaults in AI API settings.
- **UI (proposed):** “Edit prompt…” on the AI suggest step; auto-select profile by model id pattern.
- **Safety:** `preamble.txt` (locator + JSON rules) stays locked; profiles edit task wording and tag definitions only.
- **Cache:** bump profile `version` on save — same rule as `versions.json`.

Expandable **tag types** (not only `persName`/`placeName`): extend `tag-definitions.json` and the dialog tag picker from schema/project settings. Full spec: [Auto-tagging.md](../../../../docs/Auto-tagging.md) → AI mode → Immediate future.
