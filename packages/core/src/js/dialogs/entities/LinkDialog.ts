import $ from 'jquery';
import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import type { MappingID } from '../../../types';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';

class LinkDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly id: string;
  readonly dialog: DialogForm;
  readonly $el: JQuery<HTMLElement>;
  readonly mappingID: MappingID;

  entry?: Entity;
  selectedText?: string;
  type: EntityTypes = 'link';

  constructor({ writer, parentEl }: ILWDialogConfigParams) {
    this.writer = writer;
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    this.mappingID = mappingID;

    const idPrefix =
      this.mappingID == 'cwrcEntry'
        ? 'citationForm_' //orlando and cwrcEntry
        : 'linkForm_'; //tei & teiLite

    this.id = writer.getUniqueId(idPrefix);

    const entityAttributesSection = `
    <div class="entityAttributes">
      ${this.selectedTextField(this.id)}
      ${this.LinkField(this.id)}
    </div>
    `;

    this.$el = $(`
      <div class="annotationDialog">
        <div class="content">
          <div class="main">
            ${entityAttributesSection}

            <hr style="width: 100%; border: none; border-bottom: 1px solid #ccc;">

            <div
              id="${this.id}_attParent"
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

    this.dialog = new DialogForm({ writer, $el: this.$el, type: 'link', title: 'Tag Link' });

    //Show/hide if filed has content
    $(`#${this.id}_input`, this.$el).on('keyup', () => {
      const externalLinkBT = $('#external-link-button', this.$el);
      let src = $(`#${this.id}_input`).val();
      const hasVal = src && src !== '';

      hasVal ? externalLinkBT.css('display', 'inline') : externalLinkBT.css('display', 'none');
    });

    //navigate to link
    $('#external-link-button', this.$el).on('click', () => {
      let src = $(`#${this.id}_input`).val();
      if (!src) return;

      if (Array.isArray(src)) src = src[0]; //grab the first on the list.
      if (typeof src === 'number') src = src.toString();

      if (src !== '') {
        if (src.match(/^https?:\/\//) == null) src = `https://${src}`;
        try {
          window.open(src);
        } catch (error) {
          alert(error);
        }
      }
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

  private LinkField(id: string) {
    const fieldTitle = 'Hypertext link';

    const dataMapping =
      this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
        ? 'URL' //orlando and cwrcEntry
        : 'target'; //tei & teiLite

    const html = `
      <div class="attribute">
        <div>
          <p class="fieldLabel" for="${id}_input">${fieldTitle}</p>
        </div>

        <input
          type="text"
          id="${id}_input"
          data-type="textbox"
          data-mapping="${dataMapping}"
          style="margin-right: 10px"
        />
        
        <div
          id="external-link-button"
          style="display: none; padding: 4px; border-radius: 4px; cursor: pointer;"
        >
          <i class="fas fa-external-link-alt"></i>
        </div>
          
        <p style="font-size: 0.7rem; color: #666;">URL or URI</p>
      </div>
    `;

    return html;
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
    if (config?.entry) this.entry = config.entry;
    this.selectedText = config?.entry ? config.entry.content : this.getSelection();

    this.updateTextField(this.selectedText ?? '');

    this.dialog.show(config);
  }

  destroy() {
    $('#external-link-button', this.$el).off('click');
    $(`#${this.id}_input`, this.$el).off('keyup');
    this.dialog.destroy();
  }
}

export default LinkDialog;
