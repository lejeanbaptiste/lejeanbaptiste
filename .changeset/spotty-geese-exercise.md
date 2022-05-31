---
'@cwrc/leafwriter-storage-service': minor
---

### Storage Service

- [feat] Add a log manager to improve dev/prod versions

We use loglevel to control when to output logs. Improve development and production verion (no more dirty logs on production version).

- [fix] Mimetype on upload panel: Remove `text/md`, `text/tsv`, and `text/xml`.

This is a minor break, but I will treat it as a fix, since this is not
widelly publi yet. MDN recommends `application/xml` instead of
`text/xml`.

- [fix] Drag'drop height

- [test] Add a bunch of new tests

- [docs] Update and fix typos
