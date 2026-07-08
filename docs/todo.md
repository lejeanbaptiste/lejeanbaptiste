# Todo

**Plan — tagging packs**
- [x] Chinese persName (CBDB + DILA + Wikidata Tang/Ming/Qing/pre-Ming)
- [x] Pre-Ming full dump extract (Song/Yuan)
- [x] Chinese placeName (CBDB + DILA + CHGIS local)
- [x] Chinese roleName (CBDB offices)
- [x] Japanese persName (NDL persons) — 👤 validate on corpus
- [x] Japanese title partial (NDL works ~900) — expand / Wikidata works later
- [x] Japanese placeName (`ndl-places-ja`) — harvest + compile wired; run full SPARQL harvest
- [x] Japanese orgName (`ndl-orgs-ja`) — harvester built; run full SPARQL harvest (~242k)
- [x] Wikidata **ja persons** (supplement to NDL, not replacement)
- [ ] Chinese + Japanese **title** at scale (Wikidata `work` extract)
- [ ] Chinese **orgName** (Wikidata org)
- [x] Tibetan persName / placeName / org / title / roleName (Wikidata `bo` or THL)
- [ ] BDRC???
- [ ] GitLab Release for full bundle

If it stops partway through:
```bash
npm run wikidata:extract-zh-ja-orgs-works -- \
--dump "/path/to/latest-all.json.bz2" \
--progress 500000 \
--resume
```
When it finishes, compile:
```bash
npm run wikidata:compile-zh-ja-orgs-works
```

**Disambiguation**
- [ ] identical strings of different categories.
- [ ] Disambiguation testing

**Database**
- [ ] viewer
- [x] Pull dates and one-line description.
- [ ] split and merge + update in XML

**Schema editing**

**Clean-up**
- [ ] Double clicking contents should not select the node as well (?)
- [x] Zoom
- [x] Rethink context menu

**Packaging**
- [x] Clean up branding in docs
- [x] Redo icon insignia OR splash?
- [ ] Test on Linux
- [ ] Test on Windows

---

**Metadata (requires reading?)**
- [x] Make fuller list of project and file metadata, update JSON.

**Source import**
- [ ] Browser extension to import texts.

**Clean-up**
- [ ] display keyboard shortcuts on hover
- [ ] Translations
- [ ] VIAF↔Wikidata precompiled concordance — replace regex-scraped cross-authority linking in the live disambiguation panel with a compiled crosswalk (see `authority-databases-phases.md` § Deferred/future). Long-term: bundle alongside the next Wikidata-persons pack recompile; VIAF bulk dump access is currently gated/unstable, so keep the runtime regex approach until then.

**Documentation**
- [ ] Website (shortcut guide)
- [ ] Figure out what to do about external documentation