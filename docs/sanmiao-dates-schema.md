# Sanmiao date markup — TEI schema extension

**Status:** Implemented (TEI catalog schemas, 2026-07)  
**Related:** `docs/Auto-tagging.md` (East Asian dates), `docs/sanmiao-ljb-integration.md`, `docs/project-schema-planning.md`

---

## Problem

Standard TEI `<date>` allows text, `model.phrase`, and datable attributes (`when`, `notBefore`, `notAfter`, `when-custom`, `calendar`, …). It does **not** allow:

- Sanmiao **parse children**: `dyn`, `ruler`, `era`, `year`, `month`, `day`, `gz`, `sexYear`, `int`, `rel`, `suffix`, `lp`, `nmdgz`, `filler`, `season`, `gy`
- Sanmiao **resolution attributes**: `jdn`, `era_id`, `dyn_id`, `ruler_id`, `cal_stream`, `year`, `month`, `intercalary`, `day`, `gz`, `nmd_gz`, `lp`, …

Without a schema patch, sanmiao output fails RelaxNG validation in LJB.

---

## Design

### Parse layer (linguistic structure)

Written after **tag apply** or when the user accepts an ambiguous span with structure only. Safe while calendar resolution is still open.

```xml
<date cert="low" resp="#ljb-sanmiao">
  <dyn>魏</dyn><era>太和</era><year>元年</year>
</date>
```

Element names match `sanmiao.config.date_elements` (minus `date` itself). These are **local names** in the sanmiao module namespace or unprefixed children inside TEI `<date>` — choose one convention in the ODD and stick to it.

### Resolution layer (after disambiguation)

Written only when the user confirms a candidate (or auto-accept on unique solve).

```xml
<date jdn="1758531.5"
      when="0183-03-15"
      era_id="113"
      year="18"
      month="2"
      calendar="#chinese"
      cert="high"
      resp="#ljb-sanmiao">
  <era>建安</era><year>十八年</year><month>二月</month>
</date>
```

- **`jdn`** — canonical astronomical Julian Day Number (float allowed, e.g. `1758531.5`).
- **`jdnEnd`** — optional upper bound for month/year ranges.
- **`when` / `notBefore` / `notAfter`** — derived ISO 8601 for human display; recomputed if project `prolepticGregorian` or `gregorianStart` changes.
- **`era_id`, `dyn_id`, `ruler_id`, `cal_stream`** — sanmiao table IDs for re-solve without re-tagging (`attributes=True` path in `dates_xml_to_df`).
- **`dila_id` or `key`** — when linked to [DILA Time Authority](https://authority.dila.edu.tw/time/) (sanmiao `era_table.csv` has `dila_id`).

Optional later: flatten parse children to plain text once resolved; keep children if hand-editing era vs month separately is useful.

---

## LJB schema merge

On **TEI catalog schema install** (TEI All, TEI Lite, Simple Print, jTEI) and on **project open** (existing projects):

1. Upstream TEI `.rng` is saved as `schema/<name>.tei.rng`.
2. `schema/ljb-sanmiao-dates.rng` is generated with sanmiao parse children + resolution attributes.
3. `schema/<name>.rng` becomes a thin wrapper that includes both and replaces `<date>`.

**Orlando** and non-TEI schemas are unchanged in v1.

**Trigger:** automatic for TEI catalog installs; `ensureSanmiaoDatesSchema` patches legacy projects on open.

---

## Element list (from sanmiao)

From `sanmiao.config.date_elements`:

| Element | Role |
|---------|------|
| `dyn` | Dynasty name string |
| `ruler` | Ruler name string |
| `era` | Era name string |
| `year` | Year expression (e.g. 十八年, 元年) |
| `sexYear` | Sexagenary year |
| `month` | Month expression |
| `day` | Day expression |
| `gz` | Sexagenary day |
| `int` | Intercalary marker (閏) |
| `rel` | Relative prefix (`dir`, `unit` attrs) |
| `suffix` | 初, 之世, etc. |
| `lp` | Lunar phase (朔, 晦) |
| `nmdgz` | New-moon sexagenary day |
| `lp_filler`, `filler` | Particle text |
| `season` | 春/夏/秋/冬 |
| `gy` | 改元 |

---

## Resolution attributes (sanmiao `attributes=True`)

Numeric attrs read/written on `<date>` by `dates_xml_to_df` / future `apply_resolution`:

`cal_stream`, `dyn_id`, `ruler_id`, `era_id`, `ind_year`, `year`, `sex_year`, `month`, `intercalary`, `day`, `gz`, `nmd_gz`, `lp`

Plus LJB extensions: `jdn`, `jdnEnd`, optional `dila_id`.

---

## `calendarDesc` (recommended header)

```xml
<calendarDesc>
  <calendar xml:id="chinese" sameAs="https://authority.dila.edu.tw/time/">
    <p>Chinese lunisolar calendar; dates resolved with sanmiao.</p>
  </calendar>
</calendarDesc>
```

Project settings: `dateConversion.prolepticGregorian`, `gregorianStart`, `civ`, `tpq`, `taq` — document assumptions in encodingDesc or project JSON.

---

## Cert / provenance

| State | `cert` | Resolution attrs |
|-------|--------|------------------|
| Tagged, not resolved | `low` or omit | none |
| Ambiguous, in queue | `low` | none |
| User confirmed | `high` | full |
| User rejected all candidates | `unknown` | none |

Always `resp="#ljb-sanmiao"` (or project encoder) on machine-assisted dates.
