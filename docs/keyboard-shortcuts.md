# Keyboard Shortcuts Guide

This document lists all keyboard shortcuts available in Leaf Writer.

---

## Table of Contents

- [Global Application Shortcuts](#global-application-shortcuts)
- [File Operations](#file-operations)
- [Edit Menu](#edit-menu)
- [View Menu](#view-menu)
- [Editor Shortcuts](#editor-shortcuts)
- [Tagging Shortcuts](#tagging-shortcuts)
- [Find Panel](#find-panel)
- [XPath Panel](#xpath-panel)
- [File Explorer](#file-explorer)
- [Auto-Tagging Review](#auto-tagging-review)
- [Translation Pane](#translation-pane)
- [Disambiguation Panel](#disambiguation-panel)
- [Date Curator Panel](#date-curator-panel)

---

## Global Application Shortcuts

These shortcuts work across the entire application.

| Shortcut | Action | Context |
|---------|--------|---------|
| `Cmd/Ctrl + F` | Open Find panel | Global |
| `Cmd/Ctrl + ,` | Open Settings | Global |
| `Cmd/Ctrl + O` | Open Project | Global |
| `Cmd/Ctrl + S` | Save | Global |
| `Cmd/Ctrl + Shift + S` | Save As | Global |
| `Cmd/Ctrl + W` | Close Tab | Global |
| `Cmd/Ctrl + N` | New File | Global |
| `Escape` | Close foreground popup/dialog | Global |

---

## File Operations

| Shortcut | Action | Context |
|---------|--------|---------|
| `Cmd/Ctrl + O` | Open Project | Menu bar, Global |
| `Cmd/Ctrl + S` | Save current document | Menu bar, Global |
| `Cmd/Ctrl + Shift + S` | Save As | Menu bar, Global |
| `Cmd/Ctrl + W` | Close current tab | Menu bar, Global |
| `Cmd/Ctrl + N` | New File | Menu bar |
| `Cmd/Ctrl + Shift + D` | Download/Export document | Global |

---

## Edit Menu

| Shortcut | Action | Platform |
|---------|--------|----------|
| `Cmd/Ctrl + Z` | Undo | Both |
| `Cmd/Ctrl + Shift + Z` | Redo | Both |
| `Cmd/Ctrl + X` | Cut | Both |
| `Cmd/Ctrl + C` | Copy | Both |
| `Cmd/Ctrl + V` | Paste | Both |
| `Cmd/Ctrl + A` | Select All | Both |
| `Delete` | Delete | Both |

---

## View Menu

| Shortcut | Action | Platform |
|---------|--------|----------|
| `Cmd/Ctrl + F` | Find | Both |
| `Cmd/Ctrl + 0` | Reset Zoom | Both |
| `Cmd/Ctrl + +` | Zoom In | Both |
| `Cmd/Ctrl + =` | Zoom In (alternative) | Both |
| `Cmd/Ctrl + -` | Zoom Out | Both |
| `F11` | Toggle Fullscreen | Both |

---

## Editor Shortcuts

### Basic Editing

| Shortcut | Action |
|---------|--------|
| `Enter` (no selection) | Insert tag or split paragraph |
| `Enter` (with selection) | Wrap selection in tag |
| `Shift + Enter` (in `<p>`) | Split paragraph immediately |
| `F2` | Rename current element |
| `Enter` | Commit rename |
| `Shift + Enter` | Rename all identical elements |
| `Alt + Enter` | Walk through all identical elements |

### Tag Popup (when tagging)

| Shortcut | Action |
|---------|--------|
| `Enter` | Open tag popup / commit tag |
| `Shift + Enter` | Tag all identical strings the same way |
| `Alt + Enter` | Walk through all identical strings case-by-case |
| `Alt + Enter` (with selection) | Add attribute to element |

### Walk Mode

| Shortcut | Action |
|---------|--------|
| `Tab` | Skip current suggestion |
| `Enter` | Accept and move to next |
| `Shift + Enter` | Accept all identical strings |
| `Backspace` / `Delete` | Reject current suggestion |
| `Shift + Backspace` / `Shift + Delete` | Reject all identical strings |

---

## Tagging Shortcuts

### Main Tagging

| Shortcut | Action |
|---------|--------|
| `Enter` | Open tag popup |
| `Shift + Enter` | Propagate tag to all identical strings |
| `Alt + Enter` | Queue walk mode for identical strings |
| `F2` | Rename element |

### Attribute Editing

| Shortcut | Action |
|---------|--------|
| `Escape` | Close attribute popup |
| `Tab` | Move to next field (Name → Value) |
| `Shift + Tab` | Move to previous field (Value → Name) |
| `Enter` | Commit attribute |
| `Arrow Down` | Next attribute suggestion |
| `Arrow Up` | Previous attribute suggestion |

### Command Controller

| Shortcut | Action |
|---------|--------|
| `Escape` | Close popup |
| `Arrow Down` | Next suggestion |
| `Arrow Up` | Previous suggestion |
| `Enter` | Accept selected |

---

## Find Panel

| Shortcut | Action |
|---------|--------|
| `Escape` | Clear find panel / exit walk mode |
| `Enter` | Enter find walk mode |
| `F3` | Find next match |
| `Shift + F3` | Find previous match |
| `Cmd/Ctrl + G` | Find next match (alternative) |
| `Cmd/Ctrl + Shift + G` | Find previous match (alternative) |
| `Arrow Down` / `Tab` | Navigate to next result |
| `Arrow Up` / `Shift + Tab` | Navigate to previous result |
| `Enter` (in results) | Jump to selected result |
| `Shift + Enter` (replace mode) | Replace current match |
| `Enter` (replace mode) | Replace and find next |

---

## XPath Panel

| Shortcut | Action |
|---------|--------|
| `Enter` (in search field) | Execute XPath query |
| `Arrow Down` | Navigate to next result |
| `Arrow Up` | Navigate to previous result |
| `Enter` (in results) | Jump to selected XPath result |

---

## File Explorer

| Shortcut | Action |
|---------|--------|
| `Arrow Down` | Move to next item |
| `Arrow Up` | Move to previous item |
| `Arrow Right` | Expand directory / enter subdirectory |
| `Arrow Left` | Collapse directory / move to parent |
| `Enter` | Open file or expand/collapse directory |
| `F2` | Rename selected file/folder |
| `Delete` / `Backspace` | Delete selected item |

---

## Auto-Tagging Review

These shortcuts work in the Auto-Tagging review panel (for AI suggestions, dictionary matches, etc.).

| Shortcut | Action |
|---------|--------|
| `j` / `Arrow Down` | Move to next pending suggestion |
| `k` / `Arrow Up` | Move to previous pending suggestion |
| `Space` / `Spacebar` | Cycle through alternative tag suggestions |
| `Enter` | Accept current suggestion |
| `a` | Accept current suggestion (alternative) |
| `r` / `x` | Reject current suggestion |
| `u` | Undecide (revert pending to undecided) |
| `Shift + Enter` | Accept all identical strings |
| `Shift + Backspace` / `Shift + Delete` | Reject all identical strings |

---

## Translation Pane

### Text Formatting

| Shortcut | Action | Platform |
|---------|--------|----------|
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Cmd/Ctrl + U` | Underline |
| `Alt + Shift + 5` | Strikethrough |
| `Cmd/Ctrl + Shift + K` | Small caps |
| `Cmd/Ctrl + .` | Superscript |
| `Cmd/Ctrl + ,` | Subscript |
| `Cmd/Ctrl + K` | Link |
| `Cmd/Ctrl + Alt + F` | Footnote |
| `Cmd/Ctrl + M` | Clear formatting |

### Navigation

| Shortcut | Action |
|---------|--------|
| `Shift + K` | Apply small caps formatting |
| `K` (no modifiers) | Apply link formatting |
| `Alt + F` / `Alt + ƒ` | Insert footnote |
| `.` (with Cmd/Ctrl) | Apply superscript |
| `,` (with Cmd/Ctrl) | Apply subscript |
| `M` (with Cmd/Ctrl) | Remove formatting |

---

## Disambiguation Panel

| Shortcut | Action |
|---------|--------|
| `Enter` | Submit manual link |
| `j` / `k` | Navigate between candidates |
| `Enter` | Accept selected candidate |

---

## Date Curator Panel

| Shortcut | Action |
|---------|--------|
| `Enter` (no Shift) | Accept current date suggestion |
| `a` | Accept current date suggestion (alternative) |
| `r` / `x` | Reject current date suggestion |
| `u` | Undecide current suggestion |
| `j` / `k` | Navigate between suggestions |
| `Shift + Enter` | Accept all identical date strings |

---

## Summary by Context

### Menu Bar Shortcuts
- **File**: `Cmd/Ctrl+O` (Open), `Cmd/Ctrl+S` (Save), `Cmd/Ctrl+Shift+S` (Save As), `Cmd/Ctrl+W` (Close), `Cmd/Ctrl+N` (New)
- **Edit**: `Cmd/Ctrl+Z` (Undo), `Cmd/Ctrl+Shift+Z` (Redo), `Cmd/Ctrl+F` (Find)
- **View**: `Cmd/Ctrl+0` (Reset Zoom), `Cmd/Ctrl++` (Zoom In), `Cmd/Ctrl+-` (Zoom Out)

### Editor-Specific
- Tag insertion: `Enter`, `Shift+Enter`, `Alt+Enter`
- Element rename: `F2`, then `Enter`/`Shift+Enter`/`Alt+Enter`
- Attribute editing: `Alt+Enter`, then `Tab`/`Shift+Tab`/`Enter`

### Panel Navigation
- **Find/XPath**: `Arrow` keys for navigation, `Enter` to jump
- **Explorer**: `Arrow` keys, `Enter`, `F2`, `Delete`
- **Review**: `j`/`k` for navigation, `a`/`r`/`x` for accept/reject, `u` to undecide

### Formatting (Translation Pane)
- All standard formatting: `Cmd/Ctrl + [letter]` combinations
- Special: `Alt+Shift+5` (strikethrough), `Cmd/Ctrl+Alt+F` (footnote)

---

*Last updated: 2026-07-09*
