# Todo

**Plan — tagging packs**
- [ ] Chinese + Japanese **title** at scale (Wikidata `work` extract)
- [ ] Chinese **orgName** (Wikidata org)
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

**Database**
- [ ] viewer / entities
- [ ] split and merge + update in XML

**Schema editing**

**Clean-up**
- [ ] Double clicking contents should not select the node as well (?)

**Packaging**
- [ ] Reduce package size and load time
- [ ] Test on Linux
- [ ] Test on Windows
- [ ] Test on Mac

---
**Testing**
- [ ] Improve AI

---

**Source import**
- [ ] Browser extension to import texts.

**Clean-up**
- [ ] display keyboard shortcuts on hover
- [ ] Translations
- [ ] VIAF↔Wikidata precompiled concordance — replace regex-scraped cross-authority linking in the live disambiguation panel with a compiled crosswalk (see `authority-databases-phases.md` § Deferred/future). Long-term: bundle alongside the next Wikidata-persons pack recompile; VIAF bulk dump access is currently gated/unstable, so keep the runtime regex approach until then.

**Documentation**
- [ ] Website (shortcut guide)
- [ ] Figure out what to do about external documentation