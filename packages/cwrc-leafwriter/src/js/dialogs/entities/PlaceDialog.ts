import { getDefaultStore } from 'jotai';
import { RESET } from 'jotai/utils';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import { entityLookupDialogAtom } from '../../../jotai/entity-lookup';
import Entity from '../../../js/entities/Entity';
import Writer from '../../../js/Writer';
import { EntityType, namedEntityTypesSchema } from '../../../types';
import DialogForm from '../dialogForm/dialogForm';
import type { LWDialogConfigProps } from '../types';
import type { SchemaDialog } from './types';
import { getSourceNameFromUrl } from './util';

const defaultJotaiStore = getDefaultStore();

const certaintyOptions = ['high', 'medium', 'low', 'Unknown'];
const precisionOptions = ['high', 'medium', 'low', 'Unknown'];
const placeTypeOptions = ['address', 'area', 'geog', 'placename', 'region', 'settlement'];

class PlaceDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;

  entry?: Entity;
  selectedText?: string;
  type: EntityType = 'place';

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    this.writer = writer;
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    const idPrefix =
      mappingID == 'cwrcEntry'
        ? 'noteForm_' //orlando
        : 'placeForm_'; //orlando & tei & teiLite

    const id = writer.getUniqueId(idPrefix);

    const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.selectedTextField(id)}
        ${this.tagAsField(id)}
        ${mappingID === 'tei' || mappingID == 'teiLite' ? this.certaintyField(id) : ''}
        ${mappingID === 'tei' ? this.precisionField(id) : ''}
        ${mappingID === 'orlando' ? this.placeTypeField(id) : ''}
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
        </div>
      </div>
    `).appendTo(parentEl);

    //@ts-ignore
    const $relinkButton = $(`#${id}_tagAs .relink-bt`, $el).button();
    $relinkButton.on('click', () => {
      parentEl.css('display', 'none');

      const isNamedEntityType = namedEntityTypesSchema.safeParse(this.type);
      if (isNamedEntityType.success) {
        const namedEntityType = isNamedEntityType.data;

        defaultJotaiStore.set(entityLookupDialogAtom, {
          isUserAuthenticated: this.writer.overmindState.user?.uri !== '#anonymous',
          onClose: (response) => {
            defaultJotaiStore.set(entityLookupDialogAtom, RESET);
            parentEl.css('display', 'block');
            if (!response) {
              this.updateTagAs();
              return;
            }
            this.updateLink(response.name, response.uri);
            this.updateTagAs(response.name, response.uri);
          },
          query: this.entry?.getContent()?.trim() ?? '',
          type: namedEntityType,
        });
      }
    });

    this.dialog = new DialogForm({
      writer,
      $el,
      type: 'place',
      title: 'Tag Place',
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

  private selectedTextField(id: string) {
    const fieldTitle = 'Selected Text';

    return `
      <div id="${id}_selectedText" class="attribute">
        <p class="fieldLabel">${fieldTitle}</p>
        <p class="selectedText">${this.selectedText}</p>
      </div>
    `;
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

  private updateTextField(value: string) {
    const fontSize = value.length > 30 ? 1 : 1.2;
    $('.selectedText').css('font-size', `${fontSize}em`);
    $('.selectedText').text(value);
  }

  private tagAsField(id: string) {
    const fieldTitle = 'Tag as';

    return `
      <div id="${id}_tagAs" class="attribute">
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

  private certaintyField(id: string) {
    const fieldTitle = 'Level of certainty';

    const html = `
      <div
        id="${id}_certainty"
        class="attribute"
        data-transform="controlgroup"
        data-type="radio"
        data-mapping="cert"
      >
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        ${certaintyOptions
          .map((certainty) => {
            return `
            <input
              type="radio"
              id="${id}_${certainty}"
              name="${id}_id_certainty"
              value="${certainty}"
            />
            <label for="${id}_${certainty}" style="text-transform: capitalize">
              ${certainty}
            </label>
          `;
          })
          .join('\n')}
      </div>
    `;

    return html;
  }

  private precisionField(id: string) {
    const fieldTitle = 'Precision of location of place name';

    const html = `
      <div
        id="${id}_precision"
        class="attribute"
        data-transform="controlgroup"
        data-type="radio"
        data-mapping="custom.precision"
      >
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        ${precisionOptions
          .map((precision) => {
            return `
            <input
              type="radio"
              id="${id}_p_${precision}"
              name="${id}_detail_radio"
              value="${precision}"
            />
            <label for="${id}_p_${precision}" style="text-transform: capitalize">
              ${precision}
            </label>
          `;
          })
          .join('\n')}
      </div>
    `;

    return html;
  }

  private placeTypeField(id: string) {
    const fieldTitle = 'Type of place';

    const html = `
      <div
        id="${id}_certainty"
        class="attribute"
        data-transform="controlgroup"
        data-type="radio"
        data-mapping="cert"
      >
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        ${placeTypeOptions
          .map((type) => {
            return `
            <input
              type="radio"
              id="${id}_${type}"
              name="${id}_type_place"
              value="${type.toUpperCase}"
            />
            
            <label for="${id}_${type}" style="text-transform: capitalize">
              ${type}
            </label>
          `;
          })
          .join('\n')}
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

export default PlaceDialog;
