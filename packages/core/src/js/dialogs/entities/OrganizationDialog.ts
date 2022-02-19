import { MappingID } from '@src/@types';
import { EntityLink } from '@src/components/entityLookups/types';
import Entity from '@src/js/entities/Entity';
import { EntityTypes } from '@src/js/schema/types';
import Writer from '@src/js/Writer';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import { SchemaDialog } from './types';
import { getSourceNameFromUrl } from './util';

const certaintyOptions = ['high', 'medium', 'low', 'Unknown'];
const cwrcEntryOrgTypeOptions = [
  'labour',
  'club or society',
  'political',
  'academic',
  'research',
  'corporate',
  'activist',
  'governmental',
  'military',
  'law-enforcement',
  'professional',
  'sporting',
  'medical',
  'altruistic',
  'non-profit',
  'artistic',
  'dramatic',
  'ethnic',
  'literary',
  'musical',
  'religious',
  'publishing',
  'school',
];

class OrgDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;
  readonly mappingID: MappingID;

  entry?: Entity;
  selectedText?: string;
  type: EntityTypes = 'organization';

  constructor({ writer, parentEl }: ILWDialogConfigParams) {
    this.writer = writer;
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    this.mappingID = mappingID;
    const id = writer.getUniqueId('orgForm_');

    const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.selectedTextField(id)}
        ${this.tagAsField(id)}
        ${this.mappingID === 'tei' || this.mappingID === 'teiLite' ? this.certaintyField(id) : ''}
        ${this.mappingID === 'cwrcEntry' ? this.orgTypeField(id) : ''}
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

    //@ts-ignore
    const $relinkButton = $(`#${id}_tagAs .relink-bt`, $el).button();
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

    this.dialog = new DialogForm({ writer, $el, type: 'organization', title: 'Tag Organization' });
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

  private orgTypeField(id: string) {
    const fieldTitle = 'Organization type';

    const html = `
      <div id="${id}_org_type" class="attribute">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        <select data-type="select" data-mapping="ORGTYPE">
          <option value=""></option>
          ${cwrcEntryOrgTypeOptions
            .map((type) => {
              return `
                <option value="${type}" class="text-transform: capitalize;">${type}</option>
              `;
            })
            .join('\n')}
        </select>
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

export default OrgDialog;
