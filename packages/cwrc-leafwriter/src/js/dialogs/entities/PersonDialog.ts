import { getDefaultStore } from 'jotai';
import { RESET } from 'jotai/utils';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import { entityLookupDialogAtom } from '../../../jotai/entity-lookup';
import Writer from '../../../js/Writer';
import Entity from '../../../js/entities/Entity';
import type { EntityType, SchemaMappingType } from '../../../types';
import { namedEntityTypesSchema } from '../../../types/authority';
import DialogForm from '../dialogForm/dialogForm';
import type { LWDialogConfigProps } from '../types';
import type { SchemaDialog } from './types';
import { certaintyOptions, getSourceNameFromUrl } from './util';

const defaultJotaiStore = getDefaultStore();

const personTypeOptions = ['real', 'fictional', 'identifiable'];

class PersonDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;

  readonly id: string;
  readonly mappingID: SchemaMappingType;

  entry?: Entity;
  selectedText?: string;
  type: EntityType = 'person';

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    this.writer = writer;
    this.mappingID = mappingID;

    const idPrefix =
      this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
        ? 'noteForm_' //orlando and cwrcEntry
        : 'personForm_'; //tei & teiLite

    this.id = writer.getUniqueId(idPrefix);

    const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.selectedTextField(this.id)}
        ${this.tagAsField(this.id)}
        ${['tei', 'teiLite'].includes(this.mappingID) ? this.certaintyField(this.id) : ''}
        ${this.mappingID === 'tei' ? this.personTypeField(this.id) : ''}
      </div>
    `;

    const html = `
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
            <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 4px;">Attributes</h3>
            <ul></ul>
          </div>
        </div>
      </div>
    `;

    const $el = $(html).appendTo(parentEl);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    const $relinkButton = $(`#${this.id}_tagAs .relink-bt`, $el).button();
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
      type: 'person',
      title: 'Tag Person',
    });

    // this.dialog.$el.on(
    //   'buildDynamicFields',
    //   (_event: JQuery.Event, _config: unknown, _dialog: DialogForm) => {},
    // );

    // this.dialog.$el.on(
    //   'beforeShow',
    //   (_event: JQuery.Event, _config: unknown, _dialog: DialogForm) => {},
    // );

    // this.dialog.$el.on('beforeSave', (_event: JQuery.Event, dialog: DialogForm) => {});
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

  private tagAsField(id: string) {
    const fieldTitle = 'Tag as';

    const dataMapping =
      this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
        ? 'STANDARD' //orlando and cwrcEntry
        : 'prop.lemma'; //tei & teiLite

    return `
      <div id="${id}_tagAs" class="attribute">
        <div style="display: flex; align-items: center; gap: 8px;">
          <p class="fieldLabel">${fieldTitle}</p>
          
          <div class="relink-bt" style="cursor: pointer; padding: 4px;">
            <i class="fas fa-edit" />
          </div>
        </div>

        <div style="display: flex; flex-direction: column;" >
          <span class="tagAs" data-type="label" data-mapping="${dataMapping}"></span>
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

  private personTypeField(id: string) {
    const fieldTitle = 'Person type';

    const html = `
      <div
        id="${id}_type"
        class="attribute"
        data-transform="controlgroup"
        data-type="radio"
        data-mapping="type"
      >
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        <div>
        ${personTypeOptions
          .map((type) => {
            return `
              <input type="radio" id="${id}_${type}" name="${id}_type" value="${type}" />
              <label for="${id}_${type}" style="text-transform: capitalize;">${type}</label>
            `;
          })
          .join('\n')}
        </div>
        <p style="font-size: 0.7rem; color: #666; margin-top: 8px;">
          Learn more about Person Types <a href="https://vocab.lincsproject.ca/Skosmos/edit/en/page/ModeExistence" target="_blank" style="border: unset; background-color: unset; padding: unset; text-decoration: revert; vertical-align: baseline;">here</a>.
        </p>
      </div>
    `;

    return html;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  show(config: { entry: Entity; query: string; [x: string]: any }) {
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

export default PersonDialog;
