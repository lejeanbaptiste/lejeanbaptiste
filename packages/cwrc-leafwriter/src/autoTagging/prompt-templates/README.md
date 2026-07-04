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
