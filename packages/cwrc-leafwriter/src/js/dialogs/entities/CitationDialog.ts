import $ from 'jquery';
import type { EntityLink } from '../../../types/authority';
import Entity from '../../../js/entities/Entity';
import Writer from '../../../js/Writer';
import { EntityType } from '../../../types';
import DialogForm from '../dialogForm/dialogForm';
import type { LWDialogConfigProps } from '../types';
import { SchemaDialog } from './types';
import { getSourceNameFromUrl } from './util';

class CitationDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;

  entry?: Entity;
  selectedText?: string;
  type: EntityType = 'citation';

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    this.writer = writer;
    const id = writer.getUniqueId('citationForm_');
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.selectedTextField(id)}
        ${this.selectedSourceField(id)}
        ${this.citatonTextField(id)}
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
            <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 4px;">Attributes</h3>
            <ul></ul>
          </div>

          ${
            mappingID === 'tei' || mappingID === 'teiLite'
              ? '<input type="hidden" data-type="hidden" data-mapping="type" value="citation" />'
              : ''
          }
         
        </div>
      </div>
    `).appendTo(parentEl);

    //@ts-ignore
    const $relinkButton = $(`#${id}_selectedSource .relink-bt`, $el).button();
    $relinkButton.on('click', () => {
      parentEl.css('display', 'none');

      this.writer.overmindActions.ui.openEntityLookupsDialog({
        entry: this.entry,
        type: this.type,
        onClose: (response?: EntityLink) => {
          parentEl.css('display', 'block');

          if (!response) {
            this.updateTagAs();
            return;
          }

          const uri = response.uri ?? '';
          const lemma = response.name ?? '';
          this.updateLink(lemma, uri);
        },
      });
    });

    this.dialog = new DialogForm({ writer, $el, type: 'citation', title: 'Tag Citation' });

    //event
    this.dialog.$el.on('beforeShow', (event: JQuery.Event, config: any, dialog: DialogForm) => {
      //? Is this still need it?
      if (mappingID === 'orlando' || mappingID === 'cwrcEntry') {
        $(`#${id}_type`).val('citation');
      }

      if (dialog.mode === DialogForm.EDIT) {
        dialog.$el.find(`label[for=${id}_noteContent]`).hide();
        dialog.$el.find(`#${id}_noteContent`).hide();
      } else {
        dialog.$el.find(`label[for=${id}_noteContent]`).show();
        dialog.$el.find(`#${id}_noteContent`).show();
      }
    });
  }

  private updateLink(lemma: string, uri: string) {
    if (this.entry) {
      this.writer.entitiesManager.setURIForEntity(this.entry.getId(), uri);
      this.writer.entitiesManager.setLemmaForEntity(this.entry.getId(), lemma);
      this.entry = this.writer.entitiesManager.getEntity(this.entry.getId());
    }

    this.updateTagAs(lemma, uri);

    this.dialog.attributesWidget?.setAttribute('key', lemma);
    this.dialog.attributesWidget?.setAttribute('ref', uri);
  }

  private updateTagAs(lemma?: string, uri?: string) {
    if (!lemma || !uri) {
      $('.tagAsSource').hide();
      $('.tagAsSourceLink').text('');
      $('.tagAsSourceLink').attr('href', '');
      return;
    }

    $('.tagAs').text(lemma);

    const source = getSourceNameFromUrl(uri);

    $('.tagAsSource').show();
    $('.tagAsSourceLink').text(source);
    $('.tagAsSourceLink').attr('href', uri);
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

  private selectedSourceField(id: string) {
    const fieldTitle = 'Selected source';
    return `
      <div id="${id}_selectedSource" class="attribute">
        <div style="display: flex; align-items: center; gap: 8px;">
          <p class="fieldLabel">${fieldTitle}</p>
          
          <div class="relink-bt" style="cursor: pointer; padding: 4px;">
            <i class="fas fa-edit" />
          </div>
        </div>

       
        <div style="display: flex; flex-direction: column;" >
          <span class="tagAs" data-type="label" data-mapping="prop.lemma"></span>
          <span class="tagAsSource" style="color: #999; display: none;">source: 
            <a class="tagAsSourceLink" href="" target="_blank" rel="noopener noreferrer nofollow"></a>
          </span>
        </div>
      </div>
    `;
  }

  private citatonTextField(id: string) {
    const fieldTitle = 'Citation text';

    const html = `
      <div class="attribute">
        <div>
          <p class="fieldLabel" for="${id}_noteContent">${fieldTitle}</p>
        </div>

        <textarea
          id="${id}_noteContent"
          data-type="textbox"
          data-mapping="prop.noteContent"
          style="
            width: 100%;
            height: 100px;
            padding: 8px;
            border-radius: 4px;
            border-color: #bbb;
          "
        >
        </textarea>

        <p style="font-size: 0.7rem; color: #666;">
          You will be able to tag and edit the text in the main document.
        </p>
      </div>
    `;

    return html;
  }

  show(config: { [x: string]: any; entry: Entity; query: string }) {
    this.entry = config.entry ? config.entry : undefined;
    this.selectedText = config.entry ? config.entry.content : config.query;

    this.updateTextField(this.selectedText ?? '');
    if (config.name && config.uri) this.updateTagAs(config.name, config.uri);
    if (!config.uri) this.updateTagAs();

    this.dialog.show(config);
  }

  destroy() {
    this.dialog.destroy();
  }
}

export default CitationDialog;
