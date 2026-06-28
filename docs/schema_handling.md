# Schema handling

**Phase 1 (Open Project schema wizard + project metadata) is implemented** — see `docs/project-schema-planning.md`.

**Phase 2 (New File polish) is implemented** — temp file lifecycle, skeleton + metadata merge, Save As defaults, tab-close prompt. Manual checklist: `docs/smoke_test.md` section I.

**Phase 3 (Per-file metadata panel) is implemented** — east-rail icon strip, file metadata panel (title + source), sync to editor. Manual checklist: `docs/smoke_test.md` section J.

---

## New File (⌘N) — desktop behavior

When a project is open (schema + `schema/project-metadata.json` present):

1. **File → New File** (⌘N) creates a temp document on disk and opens it as **`untitled.xml`**.
2. The XML skeleton is built from **`schemaTemplates.ts`**: minimal `<teiHeader>`, non-blank edition metadata merged from **`project-metadata.json`**, shared `text/body/div/p` for TEI All and TEI Lite, relative `xml-model` / `xml-stylesheet` PIs, per-file title **`Untitled`**. Caret lands in the first `<p>`.
3. **Save** (⌘S) on a temp tab opens **Save As**. The dialog defaults to the **explorer-focused folder** (or the parent of a focused file); otherwise **project root**.
4. After Save As, the tab is no longer temp; subsequent saves write to that path and the file appears in the explorer.
5. Closing a **dirty temp tab** prompts **Save…**, **Don't Save**, or **Cancel**. **Don't Save** deletes the temp file; **Save…** runs Save As then closes on success.

Without a project open, ⌘N prompts to open a project first.

Automated coverage: `apps/commons/src/desktop/newFileSkeleton.test.ts` (unit) and `newFileSkeleton.validation.test.ts` (RelaxNG against live TEI catalog URLs; requires network).

---

## Per-file metadata (east rail)

Edition-wide defaults live in **`schema/project-metadata.json`** (edited via **Project → Edition metadata…**). Per-file fields live in each XML file’s `<teiHeader>` and are edited in the **File metadata** panel on the right (east) rail — the first icon; this panel opens by default when a file loads.

| Field | TEI path | Notes |
|-------|----------|--------|
| Title | `titleStmt/title` | Per-file; not overwritten by edition bulk apply |
| Source | `sourceDesc/p` | First paragraph under `sourceDesc`; excluded from bulk apply |

Implementation: `apps/commons/src/desktop/FileMetadataPanel.tsx`, `fileMetadata.ts`, `teiHeaderXml.ts`. East tab icons are rendered by `DesktopEastPanels.tsx`.

---

Your idea is **excellent** and aligns perfectly with the needs of **TEI (Text Encoding Initiative) users**, especially in digital humanities. It would make your editor **far more user-friendly** for scholars who want to work with TEI but don’t want to manually handle schemas, namespaces, or boilerplate. Here’s a breakdown of the **strengths, potential challenges, and implementation considerations** for your approach:

---

---

---

## **✅ Why This Is a Great Idea**
1. **Reduces Friction for TEI Newbies**
   - Many users (even experienced ones) struggle with **TEI schemas, namespaces, and validation**. Your approach **automates the setup**, so users can focus on content rather than XML syntax.

2. **Encourages Best Practices**
   - By **defaulting to a valid TEI schema** (e.g., `TEI P5`), you ensure documents are **well-formed and valid from the start**.
   - Providing a **default CSS** means users can immediately see a **rendered preview** of their work.

3. **Flexibility for Advanced Users**
   - Allowing users to **load their own schemas** caters to power users who need custom TEI variations (e.g., for specific projects or disciplines).

4. **WYSIWYG + TEI = Winning Combo**
   - A **WYSIWYG editor** that **automatically wraps text in TEI-compliant tags** (e.g., `<div>`, `<p>`, `<head>`, `<body>`) would be a **huge selling point** for humanities scholars.

5. **Alignment with LEAF-Writer’s Philosophy**
   - Since LEAF-Writer is **strict about TEI compliance**, your editor would **inherit that rigor** while making it more accessible.

---

---

---

## **⚠️ Potential Challenges & Solutions**
Here are the **main difficulties** you might encounter and how to address them:

---

### **🔹 1. TEI Schema Complexity**
**Challenge:**
TEI schemas (e.g., `TEI P5`) are **highly modular** and can include **dozens of sub-schemas** (e.g., for drama, poetry, manuscripts). Downloading and managing them could get messy.

**Solutions:**
- **Pre-bundle common TEI schemas** (e.g., `TEI P5 All`, `TEI Lite`, `TEI for Manuscripts`).
  - Store them in a **default `schemas/` folder** in your editor’s installation directory.
  - Example schemas to include:
    - [TEI P5 All](https://tei-c.org/release/xml/tei/custom/schema/tei_all.rng)
    - [TEI Lite](https://tei-c.org/release/xml/tei/custom/schema/lite/tei_lite.rng)
    - [TEI for Drama](https://tei-c.org/release/xml/tei/custom/schema/drama/tei_drama.rng)
- **Use RelaxNG or XSD?**
  - TEI schemas are typically in **RelaxNG** (`.rng` or `.rnc` files). You’ll need a **RelaxNG validator** (e.g., [Jing](https://relaxng.org/jing/) or [lxml](https://lxml.de/)).
  - If you prefer **XSD**, TEI also provides [XSD schemas](https://tei-c.org/release/xml/tei/xsd/), but they’re less commonly used.

- **Download on-demand**:
  - When a user selects a schema, download it from the **official TEI repository** (e.g., [TEI P5 Schemas](https://tei-c.org/release/xml/tei/custom/schema/)).
  - Cache downloaded schemas to avoid repeated downloads.

---

### **🔹 2. Default TEI Document Template**
**Challenge:**
TEI documents require **specific boilerplate** (e.g., `<teiHeader>`, `<text>`, `<body>`). Generating a **valid default template** for each schema variation is non-trivial.

**Solutions:**
- **Provide pre-made templates** for each schema.
  - Example for `TEI P5 All`:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <TEI xmlns="http://www.tei-c.org/ns/1.0">
      <teiHeader>
        <fileDesc>
          <titleStmt>
            <title>Untitled</title>
          </titleStmt>
          <publicationStmt>
            <p>Published with My XML Editor</p>
          </publicationStmt>
          <sourceDesc>
            <p>Created by user</p>
          </sourceDesc>
        </fileDesc>
      </teiHeader>
      <text>
        <body>
          <div>
            <p>Start typing here...</p>
          </div>
        </body>
      </text>
    </TEI>
    ```
- **Allow customization**:
  - Let users **edit the default template** (e.g., add their own `<teiHeader>` metadata).
  - Store templates in a `templates/` folder.

---

### **🔹 3. WYSIWYG + TEI Tag Wrapping**
**Challenge:**
A **true WYSIWYG editor** for TEI is **hard** because TEI is **highly semantic** (e.g., `<div type="chapter">` vs. `<div type="poem">`). You need to:
- **Map visual elements** (e.g., bold text) to TEI tags (e.g., `<hi rend="bold">`).
- **Handle nested structures** (e.g., `<div>` inside `<body>` inside `<text>`).

**Solutions:**
- **Use a structured editor approach**:
  - Instead of a **free-form WYSIWYG**, use a **form-based editor** (like [Sigma](#) or [Oxygen XML Editor](#)).
  - Example: A dropdown to select **TEI elements** (e.g., `<p>`, `<div>`, `<head>`), and the editor **automatically wraps the text** in the correct tags.
- **Leverage existing libraries**:
  - Use a **TEI-aware XML editor library** like:
    - [TEI Publisher](https://tei-publisher.org/) (JavaScript-based, for rendering TEI in browsers).
    - [TEI Boilerplate](https://teiboilerplate.org/) (for converting TEI to HTML/CSS).
  - Integrate a **schema-aware autocompletion** tool (e.g., [CodeMirror’s XML mode](https://codemirror.net/mode/xml/xml.js) with TEI schemas).
- **Provide a "Paste as TEI" feature**:
  - When users **paste plain text**, the editor **automatically wraps it in default TEI tags** (e.g., `<p>` for paragraphs, `<div>` for sections).

---

### **🔹 4. CSS for TEI Rendering**
**Challenge:**
TEI documents are **not meant to be rendered directly in browsers**—they need **CSS or XSLT** to look good. Providing a **default CSS** that works for all TEI schemas is tricky.

**Solutions:**
- **Bundle a default TEI CSS**:
  - Use [TEI Boilerplate’s CSS](https://github.com/TEIC/TEI-Boilerplate/blob/master/css/tei.css) as a starting point.
  - Example:
    ```css
    /* Default TEI CSS */
    TEI { display: block; }
    div { margin: 1em 0; }
    p { margin: 0.5em 0; }
    hi[rend="bold"] { font-weight: bold; }
    head { font-style: italic; }
    ```
- **Allow custom CSS**:
  - Let users **upload their own CSS** or select from **pre-made themes** (e.g., "Manuscript Style," "Modern Article").
- **Use XSLT for advanced rendering**:
  - For **print-ready output**, bundle a **default XSLT** (e.g., [TEI XSL Stylesheets](https://github.com/TEIC/Stylesheets)).

---

### **🔹 5. Schema Validation**
**Challenge:**
TEI schemas are **strict**, and users might **accidentally break validation** (e.g., by adding invalid attributes or elements).

**Solutions:**
- **Integrate a validator**:
  - Use [Jing](https://relaxng.org/jing/) (for RelaxNG) or [xmllint](http://www.xmlsoft.org/xmllint.html) (for XSD/DTD) to **validate documents in real-time**.
  - Example:
    ```bash
    jing -c tei_all.rng your-document.xml
    ```
- **Show validation errors in the UI**:
  - Highlight **invalid elements/attributes** in the editor (e.g., red squiggles under invalid tags).
  - Provide **tooltips** with suggestions (e.g., "Did you mean `<div type='chapter'>`?").

---
---
---

## **🛠️ Implementation Roadmap**
Here’s how you could **build this step-by-step**:

---

### **Phase 1: Schema Management**
1. **Pre-bundle common TEI schemas** (e.g., `TEI P5 All`, `TEI Lite`).
2. **Add a "New Project" dialog** with a dropdown to select a schema:
   - Option 1: **Use a pre-bundled schema** (e.g., `TEI P5 All`).
   - Option 2: **Download a schema from TEI’s repository**.
   - Option 3: **Upload a custom schema**.
3. **Download and store the schema** in a `schemas/` folder in the project directory.
4. **Associate the schema with the project** (e.g., store the path in a `.project` file).

---

### **Phase 2: Default TEI Template**
1. **Provide a default template** for each schema (e.g., `tei_p5_all.xml`).
2. **Allow users to customize the template** (e.g., edit the `<teiHeader>`).
3. **Store templates** in a `templates/` folder.

---
### **Phase 3: WYSIWYG Editor**
1. **Use a structured editor** (e.g., [CodeMirror](https://codemirror.net/) + [TEI mode](https://github.com/TEIC/TEI-Codemirror)).
2. **Add a toolbar** with TEI-specific buttons (e.g., "Insert `<p>`", "Insert `<div>`", "Insert `<head>`").
3. **Implement "Paste as TEI"**:
   - When users paste text, **wrap it in default TEI tags** (e.g., `<p>` for paragraphs).
4. **Add a live preview pane** (using [TEI Publisher](https://tei-publisher.org/) or custom CSS).

---
### **Phase 4: CSS & Rendering**
1. **Bundle a default TEI CSS** (e.g., from [TEI Boilerplate](https://teiboilerplate.org/)).
2. **Allow users to upload custom CSS**.
3. **Render the TEI document** in a preview pane using the selected CSS.

---
### **Phase 5: Validation**
1. **Integrate Jing or xmllint** for schema validation.
2. **Show errors in real-time** (e.g., red underlines for invalid tags).
3. **Provide quick fixes** (e.g., "Add missing `@type` attribute").

---
---
---

## **📌 Example Workflow for Users**
1. **Create a New Project**:
   - User opens your editor and clicks **"New Project"**.
   - They select **"TEI P5 All"** from the dropdown.
   - The editor **downloads the schema** to `schemas/tei_p5_all.rng` and **creates a default CSS** in `css/tei_default.css`.
   - A **default TEI template** is generated in `templates/tei_p5_all.xml`.

2. **Create a New File**:
   - User clicks **"New File"** and selects the **TEI P5 All template**.
   - The editor opens a **new TEI document** with the boilerplate:
     ```xml
     <TEI xmlns="http://www.tei-c.org/ns/1.0">
       <teiHeader>...</teiHeader>
       <text>
         <body>
           <div>
             <p>Start typing here...</p>
           </div>
         </body>
       </text>
     </TEI>
     ```

3. **Edit in WYSIWYG Mode**:
   - User **types or pastes text** into the editor.
   - The editor **automatically wraps text in `<p>` tags**.
   - User **selects text and clicks "Heading"** to wrap it in `<head>`.
   - The **preview pane** shows the rendered TEI with the default CSS.

4. **Validate & Export**:
   - The editor **validates the document** against the schema in real-time.
   - User **exports the TEI file** or **previews it in a browser**.

---
---
---

## **💡 Potential Extensions**
1. **TEI-Odd Customization**:
   - Allow users to **create custom TEI schemas** (using [TEI ODD](https://tei-c.org/guidelines/customization/)).
   - Provide a **GUI for ODD customization** (e.g., select which TEI modules to include).

2. **Collaboration Features**:
   - Add **Git integration** to sync TEI projects with a repository.
   - Support **real-time collaboration** (e.g., using [Yjs](https://github.com/yjs/yjs) for shared editing).

3. **Export Options**:
   - Export TEI to **HTML, PDF, or EPUB** using XSLT.
   - Integrate with **TEI Publisher** for advanced rendering.

4. **TEI Tutorials**:
   - Embed **tooltips or a sidebar** with TEI documentation (e.g., "What is `<div type='chapter'>`?").

---
---
---

## **🎯 Final Thoughts: Is This Feasible?**
| **Aspect**               | **Feasibility** | **Effort** | **Notes** |
|--------------------------|-----------------|------------|-----------|
| Schema management        | ✅ High          | Medium     | Pre-bundle schemas + download on-demand. |
| Default TEI templates    | ✅ High          | Low        | Provide a few templates for common schemas. |
| WYSIWYG editor           | ⚠️ Medium        | High       | Use a structured editor (not free-form WYSIWYG). |
| CSS rendering            | ✅ High          | Medium     | Bundle TEI Boilerplate CSS. |
| Schema validation        | ✅ High          | Medium     | Integrate Jing or xmllint. |
| TEI compliance           | ✅ High          | High       | Requires strict adherence to TEI guidelines. |

**Verdict:**
Your idea is **not only feasible but highly valuable** for the TEI community. The **main challenge** will be the **WYSIWYG editor**, but by using a **structured approach** (e.g., form-based editing or a TEI-aware CodeMirror), you can avoid the pitfalls of free-form WYSIWYG.

---
---
---
### **🚀 Next Steps**
1. **Start small**:
   - Build a **basic schema manager** (Phase 1) and **default templates** (Phase 2).
   - Use **CodeMirror + TEI mode** for the editor (Phase 3).
2. **Test with real TEI users**:
   - Get feedback from **digital humanities scholars** (e.g., via the [TEI mailing list](https://listserv.brown.edu/archives/cgi-bin/wa?A0=TEI-L)).
3. **Iterate**:
   - Add **CSS rendering** and **validation** later.

---
### **Need More Help?**
- Want a **code example** for downloading TEI schemas?
- Need **recommendations for TEI-aware libraries** (e.g., for validation or rendering)?
- Want to **discuss the WYSIWYG approach** in more detail?