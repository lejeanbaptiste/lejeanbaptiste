import $ from 'jquery';
import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import type { SchemaMappingType } from '../../../types';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';

class DateDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;
  readonly mappingID: SchemaMappingType;

  entry?: Entity;
  selectedText?: string;
  type: EntityTypes = 'correction';

  constructor({ writer, parentEl }: ILWDialogConfigParams) {
    this.writer = writer;
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    this.mappingID = mappingID;
    const id = writer.getUniqueId('corrForm_');

    const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.selectedTextField(id)}
        ${this.correctionField()}
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
        </div>
      </div>
    `).appendTo(parentEl);

    this.dialog = new DialogForm({ writer, $el, type: 'correction', title: 'Tag Correction' });

    //Events
    // Orlando and cwrcEntry doesn't need these events
    if (this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry') return;

    this.dialog.$el.on('beforeShow', (event: JQuery.Event, config: any, dialog: DialogForm) => {
      let sicText: string | undefined;

      if (dialog.mode === DialogForm.ADD) {
        const currentBookmark = this.writer.editor?.currentBookmark;
        if (!currentBookmark) return;

        if ('rng' in currentBookmark) {
          sicText = currentBookmark.rng.toString();
        }
      } else {
        sicText = config.entry.getCustomValue('sicText');
        if (!sicText) {
          // update corrText from entity content
          const content = config.entry.getContent();
          $el.find('textarea').val(content);
        }
      }

      if (sicText !== undefined && sicText !== '') {
        dialog.currentData.customValues.sicText = sicText;
      }
    });

    this.dialog.$el.on('beforeSave', (event: JQuery.Event, dialog: DialogForm) => {
      if (!writer.editor) return;
      const sicText = dialog.currentData.customValues.sicText;
      const corrText = dialog.currentData.customValues.corrText;

      if (!sicText) return;

      if (dialog.mode === DialogForm.EDIT) {
        // set editor and entity content from corrText
        const entityId = writer.entitiesManager.getCurrentEntity();
        if (!entityId) return;

        $(`#${entityId}`, writer.editor.getBody()).text(corrText);
        writer.entitiesManager.getEntity(entityId).setContent(corrText);

        return;
      }

      // then DialogForm.ADD

      // insert the correction text
      const tempId = writer.getUniqueId('temp');
      const $temp = $(`<span id="${tempId}"/>`, writer.editor.getDoc());
      // const range = writer.editor.selection.getRng(true);
      const range = writer.editor.selection.getRng();

      // insert temp span at the current range
      range.surroundContents($temp[0]);

      // add the text content
      $temp.html(corrText);
      const textNode = $temp[0].firstChild;

      if (!textNode) return;

      // remove the temp span
      $(textNode).unwrap();

      // select the text content as the new range and save as bookmark
      range.selectNodeContents(textNode);
      writer.editor.currentBookmark = writer.editor.selection.getBookmark(1);
    });
  }

  private selectedTextField(id: string) {
    const fieldTitle = 'Selected Text';

    return `
      <div id="${id}_selectedText" class="attribute">
        <p class="fieldLabel">${fieldTitle}</p>
        <p class="selectedText">${this.selectedText}</p>
      </div>
    `;
  }

  private updateTextField(value: string) {
    const fontSize = value.length > 30 ? 1 : 1.2;
    $('.selectedText').css('font-size', `${fontSize}em`);
    $('.selectedText').text(value);
  }

  private correctionField() {
    const fieldTitle = 'Correction';

    const dataMapping =
      this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
        ? 'CORR' //orlando and cwrcEntry
        : 'custom.corrText'; //tei & teiLite

    return `
      <div class="attribute">
        <p class="fieldLabel">${fieldTitle}</p>

        <textarea
          data-type="textbox"
          data-mapping="${dataMapping}"
          style="width: 100%; padding: 8px; border-radius: 4px; border-color: #bbb;"
        >
        </textarea>
      </div>
    `;
  }

  private getSelection() {
    const currentBookmark = this.writer.editor?.currentBookmark;
    if (!currentBookmark) return;

    if ('rng' in currentBookmark) {
      let selection = currentBookmark.rng.toString();
      selection = selection.trim().replace(/\s+/g, ' '); // remove excess whitespace
      return selection;
    }
    return;
  }

  show(config?: { [x: string]: any; entry: Entity }) {
    this.entry = config?.entry ? config.entry : undefined;
    this.selectedText = config?.entry ? config.entry.content : this.getSelection();

    this.updateTextField(this.selectedText ?? '');

    this.dialog.show(config);
  }

  destroy() {
    this.dialog.destroy();
  }
}

export default DateDialog;
