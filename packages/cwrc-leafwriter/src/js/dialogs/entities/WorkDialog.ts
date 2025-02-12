import { getDefaultStore } from 'jotai';
import { RESET } from 'jotai/utils';
import $ from 'jquery';
import { entityLookupDialogAtom } from '../../../jotai/entity-lookup';
import type { EntityType, SchemaMappingType } from '../../../types';
import { namedEntityTypesSchema } from '../../../types/authority';
import Entity from '../../entities/Entity';
import Writer from '../../Writer';
import DialogForm from '../dialogForm/dialogForm';
import type { LWDialogConfigProps } from '../types';
import type { SchemaDialog } from './types';
import { getSourceNameFromUrl } from './util';

const defaultJotaiStore = getDefaultStore();

interface WorLevel {
  level: string;
  description: string;
  type: string;
}

const workLevels: WorLevel[] = [
  {
    level: 'a',
    type: 'Analytic',
    description: 'Analytic article, poem, or other item published as part of a larger item',
  },
  {
    level: 'm',
    type: 'Monographic',
    description:
      'Monographic book, collection, single volume, or other item published as a distinct item',
  },
  {
    level: 'j',
    type: 'Journal',
    description: 'Journal magazine, newspaper or other periodical publication',
  },
  {
    level: 's',
    type: 'Series',
    description: 'Series book, radio, or other series',
  },
  {
    level: 'u',
    type: 'Unpublished',
    description: 'Unpublished thesis, manuscript, letters or other unpublished material',
  },
];

const certaintyOptions = ['high', 'medium', 'low', 'Unknown'];

class WorkDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;
  readonly mappingID: SchemaMappingType;

  entry?: Entity;
  selectedText?: string;
  type: EntityType = 'work';

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    this.writer = writer;
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    this.mappingID = mappingID;

    const idPrefix =
      this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
        ? 'noteForm_' //orlando and cwrcEntry
        : 'titleForm_'; //tei & teiLite

    const id = writer.getUniqueId(idPrefix);

    const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.selectedTextField(id)}
        ${this.tagAsField(id)}
        ${this.mappingID === 'tei' || this.mappingID === 'teiLite' ? this.certaintyField(id) : ''}
        ${this.titleLevelField(id)}
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
      type: 'work',
      title: 'Tag Work',
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

  private tagAsField(id: string) {
    const fieldTitle = 'Tag as';

    //? it might be necesary to check on this - change the mapping accordin to the schema mapping
    // const dataMapping =
    //   this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
    //     ? 'STANDARD' //orlando and cwrcEntry
    //     : 'prop.lemma'; //tei & teiLite

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

  private titleLevelField(id: string) {
    const fieldTitle = 'This work is';

    const valueEncoding =
      this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
        ? 'type' //orlando and cwrcEntry
        : 'level'; //tei & teiLite

    const dataMapping =
      this.mappingID === 'orlando'
        ? 'TITLETYPE'
        : this.mappingID == 'cwrcEntry'
          ? 'LEVEL'
          : 'level'; //tei & teiLite

    const html = `
      <div
        id="${id}_level"
        class="attribute"
        data-transform="controlgroup"
        data-type="radio"
        data-mapping="${dataMapping}"
      >
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        ${workLevels
          .map(({ level, type, description }) => {
            const valueEncoding =
              this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
                ? type.toUpperCase() //orlando and cwrcEntry
                : level; //tei & teiLite

            return `
              <input
                type="radio"
                value="${valueEncoding}"
                name="level"
                id="${id}_level_${level}"
              />
              <label
                for="${id}_level_${level}"
                style=" width: 100%; margin-bottom: 4px; text-align: left; border-radius: 4px;"
              >
                <span
                  style="
                    display: block;
                    padding-bottom: 2px;
                    font-weight: 700;
                    text-transform: capitalize;
                  "
                >
                  ${this.mappingID === 'tei' || this.mappingID == 'teiLite' ? ' Level' : ''}
                  ${valueEncoding}
                </span>
                <span style="font-size: 0.8rem;">${description}</span>
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

export default WorkDialog;
