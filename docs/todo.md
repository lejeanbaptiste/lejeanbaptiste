# Todo

- [ ] XML editing mode autofill.
- [ ] Test and perfect multi-file XPATH search and highlighting.
- [ ] AI api integration for tagging without modifying the language (?).
- [ ] Attribute panel
- [ ] SQL integration (?)
- [ ] New document (creates not a blank, but an empty schema-formatted file)
- [ ] Metadata button, opens dialogue to fill out TEI metadata
- [ ] make sure that we can move and rename documents in the explorer.
- [ ] Use gold standard for autocomplete (redhat-developer/vscode-xml)
- [ ] Intelligent shortcut keys all around.
- [ ] Functional explorer: move, rename, and delete files.

Menu
- [ ] New project

Editor
- [ ] Fast add tag
- [ ] Fast add attributes

2. Finish explorer basics (high priority for daily DH work)
You have two related items:

Functional explorer: move, rename, delete
Make sure we can move and rename documents in the explorer
The file tree is central to a project-based editor. Until this works, people will still use Finder alongside the app — which breaks the “desktop app” feel.

3. Polish what you just built (medium priority)
Worth a focused pass before moving to big new features:

Test and perfect multi-file XPath search and highlighting — you’ve got single-file/source jumps working; multi-file scope is the next leap
Find/replace behavior — does Replace work in Source mode? Across files?
Source mode autocomplete — your list mentions gold standard: redhat-developer/vscode-xml; that’s the natural upgrade path for Monaco XML editing
4. “New document” + metadata (medium priority, very TEI-relevant)
For a scholarly editor, these are high value:

New document — empty but schema-valid TEI skeleton, not a blank file
Metadata button — TEI header dialog
That’s often what people need before they start tagging body text.

5. Editor power features (later, but on your radar)
Fast add tag / fast add attributes
Attribute panel
XML editing mode autofill
Intelligent shortcut keys all around (⌘F was one piece of this)
6. Big / exploratory items (park for now)
AI tagging API
SQL integration
New project (menu item)
These are interesting but depend on the core file/editing workflow being rock-solid first.

