import $ from 'jquery';
import 'jquery-ui/ui/widgets/checkboxradio';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
//include RDF button label
const RDFButtonLabel = 'LOD Annotation'; //'Include RDF';
class Selection {
    id;
    selectionTrimLength = 500_000;
    writer;
    $includeRdf;
    $prismContainer;
    $selectionContents;
    editor;
    enabled = true;
    lastUpdate = 0;
    showingFullDoc = true;
    constructor({ parentId, writer }) {
        this.writer = writer;
        this.id = this.writer.getUniqueId('selection_');
        this.lastUpdate = new Date().getTime();
        // add to writer
        this.writer.selection = this; // needed by view markup button
        // * resize container to fill height
        const resizeObserver = new ResizeObserver((entries) => {
            const editorContainer = $('#monac');
            if (editorContainer) {
                editorContainer.height(entries[0].contentRect.height - 20);
            }
        });
        resizeObserver.observe($(`#${parentId}`)[0]);
        $(`#${parentId}`).append(`
    <div class="moduleParent" >
      <div
        id="monac"
        class="Editor"
        style="
          min-height: 600px;
          margin: 8px;
          overflow: hidden;
          border-radius: 4px;
          box-shadow:  0 0 4px #d1d1d1;
        "
      />
      <div id="${this.id}-footer" class="moduleFooter" style="border-top: 0px;">
          <label>
            ${RDFButtonLabel}
            <input type="checkbox" name="includeRdf" />
          </label>
      </div>
      <div id="${this.id}_selectionContents" style="display: none;" />
    </div>
  `);
        this.$prismContainer = $(`#${this.id}`);
        this.$selectionContents = $(`#${this.id}_selectionContents`);
        //@ts-ignore
        this.$includeRdf = $(`#${this.id}-footer [name="includeRdf"]`).checkboxradio({ icon: false });
        this.$includeRdf.on('click', (event) => this.updateView(true));
        this.writer.event('loadingDocument').subscribe(() => this.clearView());
        this.writer.event('selectionChanged').subscribe(() => {
            if (!this.writer.editor?.selection.isCollapsed()) {
                this.updateView();
            }
            else if (!this.showingFullDoc) {
                this.updateView(true);
            }
        });
        this.writer.event('contentChanged').subscribe(() => this.updateView(true));
        this.writer.event('nodeChanged').subscribe(() => {
            if (!this.showingFullDoc)
                this.updateView();
        });
        this.writer.event('tagSelected').subscribe(() => this.updateView());
        this.writer.event('tagAdded').subscribe(() => this.updateView(true));
        this.writer.event('tagEdited').subscribe(() => this.updateView(true));
        this.writer.event('tagRemoved').subscribe(() => this.updateView(true));
        this.writer.event('massUpdateStarted').subscribe(() => this.disable());
        this.writer.event('massUpdateCompleted').subscribe(() => this.enable(true));
        this.writer.event('documentLoaded').subscribe(() => this.updateView(true, true));
        this.writer.layoutManager.showModule('selection');
    }
    async updateView(useDoc = false, initialSetup = false) {
        if (!this.enabled)
            return;
        if (!this.editor)
            this.setupEditor();
        if (!this.editor)
            return;
        if (useDoc || this.writer.editor?.selection.isCollapsed()) {
            this.showingFullDoc = true;
            const includeRdf = this.$includeRdf.prop('checked');
            const content = await this.writer.converter.getDocumentContent(includeRdf);
            if (!content)
                return;
            this.editor.setValue(content);
        }
        else {
            this.showingFullDoc = false;
            const range = this.writer.editor?.selection.getRng();
            const contents = range?.cloneContents();
            if (contents)
                this.$selectionContents.html(contents);
            const xmlString = this.writer.converter.buildXMLString(this.$selectionContents[0]);
            this.editor.setValue(xmlString);
            //   var decorations = this.editor.deltaDecorations(
            //     [],
            //     [
            //       {
            //         range: new monaco.Range(3, 1, 5, 1),
            //         options: {
            //           isWholeLine: true,
            //           linesDecorationsClassName: 'myLineDecoration',
            //         },
            //       },
            //       {
            //         range: new monaco.Range(7, 1, 7, 24),
            //         options: { inlineClassName: 'myInlineDecoration' },
            //       },
            //     ]
            //   );
        }
    }
    setupEditor() {
        const container = document.getElementById('monac');
        if (!container)
            return;
        this.editor = monaco.editor.create(container, {
            lineNumbers: 'off',
            language: 'xml',
            minimap: { enabled: false },
            readOnly: true,
            theme: this.writer.overmindState.ui.darkMode ? 'vs-dark' : 'vs',
            value: '',
            wordWrap: 'on',
            wrappingIndent: 'same',
            fontSize: 10,
            automaticLayout: true,
        });
    }
    clearView() {
        this.$prismContainer.html('');
    }
    enable(forceUpdate) {
        this.enabled = true;
        if (forceUpdate)
            this.updateView(true);
    }
    disable() {
        this.enabled = false;
    }
    showSelection() {
        this.writer.layoutManager.showModule('selection');
        this.updateView(true);
    }
    destroy() {
        this.editor?.dispose();
        this.writer.event('loadingDocument').unsubscribe(() => this.clearView());
        this.writer.event('selectionChanged').unsubscribe(() => {
            if (!this.writer.editor?.selection.isCollapsed()) {
                this.updateView();
            }
            else if (!this.showingFullDoc) {
                this.updateView(true);
            }
        });
        this.writer.event('contentChanged').unsubscribe(() => this.updateView(true));
        this.writer.event('nodeChanged').unsubscribe(() => {
            if (!this.showingFullDoc)
                this.updateView();
        });
        this.writer.event('tagSelected').unsubscribe(() => this.updateView());
        this.writer.event('tagAdded').unsubscribe(() => this.updateView(true));
        this.writer.event('tagEdited').unsubscribe(() => this.updateView(true));
        this.writer.event('tagRemoved').unsubscribe(() => this.updateView(true));
        this.writer.event('massUpdateStarted').unsubscribe(() => this.disable());
        this.writer.event('massUpdateCompleted').unsubscribe(() => this.enable(true));
        this.writer.event('documentLoaded').unsubscribe(() => this.updateView(true, true));
    }
}
export default Selection;
//# sourceMappingURL=index.js.map