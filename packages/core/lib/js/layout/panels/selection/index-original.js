import $ from 'jquery';
import 'jquery-ui/ui/widgets/checkboxradio';
import { highlightElement } from 'prismjs';
//include RDF button label
const RDFButtonLabel = 'LOD Annotation'; //'Include RDF';
class Selection {
    id;
    selectionTrimLength = 500_000;
    writer;
    $includeRdf;
    $prismContainer;
    $selectionContents;
    enabled = true;
    lastUpdate = 0;
    showingFullDoc = false;
    constructor({ parentId, writer }) {
        this.writer = writer;
        this.id = this.writer.getUniqueId('selection_');
        this.lastUpdate = new Date().getTime();
        // add to writer
        //@ts-ignore
        this.writer.selection = this; // needed by view markup button
        $(`#${parentId}`).append(`
    <div class="moduleParent">
      <div id="${this.id}" class="moduleContent" style="padding-bottom: 8px; font-size: 0.8em;"/>
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
    }
    async updateView(useDoc = false, initialSetup = false) {
        if (!this.enabled)
            return;
        const timestamp = new Date().getTime();
        const timeDiff = timestamp - this.lastUpdate; // track to avoid double update on nodeChanged/tagSelected combo
        if ((!this.$prismContainer.is(':visible') || timeDiff < 250) && !initialSetup)
            return;
        this.lastUpdate = new Date().getTime();
        if (useDoc || this.writer.editor?.selection.isCollapsed()) {
            this.showingFullDoc = true;
            const includeRdf = this.$includeRdf.prop('checked');
            const content = await this.writer.converter.getDocumentContent(includeRdf);
            if (!content)
                return;
            this.showString(content);
        }
        else {
            this.showingFullDoc = false;
            const range = this.writer.editor?.selection.getRng();
            const contents = range?.cloneContents();
            if (contents)
                this.$selectionContents.html(contents);
            const xmlString = this.writer.converter.buildXMLString(this.$selectionContents[0]);
            this.showString(xmlString);
        }
    }
    showString(xmlString) {
        let escapedContents = this.writer.utilities.escapeHTMLString(xmlString);
        if (escapedContents.length > this.selectionTrimLength) {
            escapedContents = escapedContents.substring(0, this.selectionTrimLength);
        }
        this.$prismContainer.html(`<pre
        style="
          height: 100%;
          padding: 8px;
          margin: 4px;
          border: none !important;
          box-shadow: 0 0 2px #d1d1d1;
          overflow-x: hidden;
        "
      >
      <code " style="white-space: pre-wrap;">
        ${escapedContents}
      </code>
    </pre>`);
        highlightElement($('code', this.$prismContainer)[0]);
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
//# sourceMappingURL=index-original.js.map