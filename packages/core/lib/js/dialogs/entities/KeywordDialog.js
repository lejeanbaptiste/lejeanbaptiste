import $ from 'jquery';
import DialogForm from '../dialogForm/dialogForm';
class KeywordDialog {
    writer;
    dialog;
    mappingID;
    forceSave = false; // needed for confirmation dialog in beforeSave
    entry;
    selectedText;
    type = 'keyword';
    constructor({ writer, parentEl }) {
        this.writer = writer;
        const mappingID = writer.schemaManager.mapper.currentMappingsId;
        if (!mappingID)
            throw Error('Schema Mappings not found');
        this.mappingID = mappingID;
        const id = writer.getUniqueId('keywordForm_');
        const entityAttributesSection = `
      <div class="entityAttributes">
      ${this.selectedTextField(id)}
      ${this.noteContentField(id)}
      </div>
    `;
        const $el = $(`
      <div class="annotationDialog">
        <div class="content">
          <div class="main">
            ${entityAttributesSection}

            <hr style="width: 100%; border: none; border-bottom: 1px solid #ccc;">

            <div
              id="${id}_attParent"
              class="attributes"
              data-type="attributes"
              data-mapping="attributes"
            />
          </div>

          <div class="attributeSelector">
            <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 4px;">Markups</h3>
            <ul></ul>
          </div>

          ${this.mappingID === 'tei' || this.mappingID === 'teiLite'
            ? '<input type="hidden" data-type="hidden" data-mapping="type" value="keyword" />'
            : ''}
        </div>
      </div>
    `).appendTo(parentEl);
        this.dialog = new DialogForm({ writer, $el, type: 'keyword', title: 'Tag Keyword' });
        //Save events
        //Orlando and cwrcEntry don't rely on these events
        if (this.mappingID === 'orlando' || this.mappingID === 'cwrcEntry')
            return;
        this.dialog.$el.on('beforeSave', (event, dialog) => {
            if (this.forceSave) {
                dialog.isValid = true;
                return;
            }
            //@ts-ignore
            if (dialog.currentData.attributes.ana !== undefined) {
                dialog.isValid = true;
                return;
            }
            dialog.isValid = false;
            this.writer.dialogManager.confirm({
                title: 'Warning',
                msg: `
            <p>A human-readable keyword is preferably linked, using the "ana" attribute, to a controlled vocabulary.</p>
            <p>Click "Add Link" to add a URL for your term or "Skip Link" to save as is.</p>
          `,
                yesText: 'Skip Link',
                noText: 'Add Link',
                showConfirmKey: 'confirm-tei-keyword',
                type: 'info',
                callback: (doIt) => {
                    setTimeout(() => {
                        // need setTimeout in case confirm dialog is skipped
                        if (!doIt)
                            return;
                        this.forceSave = true;
                        dialog.save();
                    });
                },
            });
        });
        this.dialog.$el.on('beforeShow', (event, config) => {
            this.dialog.isValid = true;
            this.forceSave = false;
            if (this.dialog.mode === DialogForm.ADD) {
                //@ts-ignore
                this.dialog.attributesWidget.setData({ ana: '' });
                this.dialog.$el.find(`label[for=${id}_noteContent]`).show();
                this.dialog.$el.find(`#${id}_noteContent`).show();
            }
            else {
                this.dialog.$el.find(`label[for=${id}_noteContent]`).hide();
                this.dialog.$el.find(`#${id}_noteContent`).hide();
            }
        });
    }
    selectedTextField(id) {
        const fieldTitle = 'Selected Text';
        return `
      <div id="${id}_selectedText" class="attribute">
        <p class="fieldLabel">${fieldTitle}</p>
        <p class="selectedText">${this.selectedText}</p>
      </div>
    `;
    }
    updateTextField(value) {
        const fontSize = value.length > 30 ? 1 : 1.2;
        $('.selectedText').css('font-size', `${fontSize}em`);
        $('.selectedText').text(value);
    }
    noteContentField(id) {
        const fieldTitle = 'Keyword';
        const dataMapping = this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
            ? 'KEYWORDTYPE' //orlando and cwrcEntry
            : 'prop.noteContent'; //tei & teiLite
        const html = `
      <div class="attribute">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        <input
          type="text"
          id="${id}_noteContent"
          data-type="textbox"
          data-mapping="${dataMapping}"
          style="width: 100%"
        />

        <p style="font-size: 0.7rem; color: #666;">
          You will be able to edit the keyword in the main document.
        </p>
      </div>
    `;
        return html;
    }
    getSelection() {
        const currentBookmark = this.writer.editor?.currentBookmark;
        if (!currentBookmark)
            return;
        if ('rng' in currentBookmark) {
            let selection = currentBookmark.rng.toString();
            selection = selection.trim().replace(/\s+/g, ' '); // remove excess whitespace
            return selection;
        }
        return;
    }
    show(config) {
        if (config?.entry)
            this.entry;
        this.selectedText = config?.entry ? config.entry.content : this.getSelection();
        this.updateTextField(this.selectedText ?? '');
        this.dialog.show(config);
    }
    destroy() {
        this.dialog.destroy();
    }
}
export default KeywordDialog;
//# sourceMappingURL=KeywordDialog.js.map