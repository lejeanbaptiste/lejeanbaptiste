import { getDefaultStore } from 'jotai';
import { RESET } from 'jotai/utils';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import { defaultRoles } from '../../../config/personRole';
import { entityLookupDialogAtom } from '../../../jotai/entity-lookup';
import Writer from '../../../js/Writer';
import Entity from '../../../js/entities/Entity';
import type { EntityType, SchemaMappingType } from '../../../types';
import { namedEntityTypesSchema } from '../../../types/authority';
import { capitalizeFirstLetter } from '../../utilities';
import DialogForm from '../dialogForm/dialogForm';
import type { LWDialogConfigProps } from '../types';
import type { SchemaDialog } from './types';
import { getSourceNameFromUrl } from './util';

const defaultJotaiStore = getDefaultStore();

interface Role {
  label: string;
  value: string;
}

const personTypeOptions = ['real', 'fictional', 'both'];
const certaintyOptions = ['high', 'medium', 'low', 'unknown'];

class PersonDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;

  readonly id: string;
  readonly mappingID: SchemaMappingType;
  readonly roleAtt: any;

  entry?: Entity;
  selectedText?: string;
  type: EntityType = 'person';

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    this.writer = writer;
    this.mappingID = mappingID;

    const typeParentTag = writer.schemaManager.mapper.getParentTag('person') ?? '';
    const atts = writer.schemaManager.getAttributesForTag(typeParentTag);
    this.roleAtt = atts.find(({ name }) => name === 'role');

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
        ${['tei', 'teiLite'].includes(this.mappingID) ? this.personRoleField(this.id) : ''}
        ${['tei', 'teiLite'].includes(this.mappingID) ? this.otherTypeField(this.id) : ''}
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

    const optionsRoleElement = this.dialog.$el.find(`#${this.id}_role`);
    const personOtherRoleElement = this.dialog.$el.find(`#${this.id}_personOtherRole`);

    this.dialog.$el.on(
      'buildDynamicFields',
      (event: JQuery.Event, config: any, dialog: DialogForm) => {
        const roleChoices: Role[] = this.roleAtt?.choices ? this.roleAtt.choices : defaultRoles;
        const sortedRoleChoices = roleChoices.sort((a, b) => {
          if (a.label.toUpperCase() < b.label.toUpperCase()) return -1;
          if (a.label.toUpperCase() > b.label.toUpperCase()) return 1;
          return 0;
        });
        const choiceOptions = this.generateRoleOptions(sortedRoleChoices);
        optionsRoleElement.html(choiceOptions);
      },
    );

    this.dialog.$el.on('beforeShow', (event: JQuery.Event, config: any, dialog: DialogForm) => {
      //Roles
      const typeValue = optionsRoleElement.val();
      const showOtherTypeTextField = !this.roleAtt?.choices && typeValue === 'other' ? true : false;
      this.toggleOtherTypeTextField(showOtherTypeTextField);
    });

    this.dialog.$el.on('beforeSave', (event: JQuery.Event, dialog: DialogForm) => {
      //replace other type option for custom defined value
      if (!this.roleAtt?.choices && optionsRoleElement.val() === 'other') {
        const otherRoleFieldValue = dialog.$el.find(`#${this.id}_personOtherRole`).val();
        const typeCustomOption = `
          <option value="${otherRoleFieldValue}" selected>${otherRoleFieldValue}</option>
        `;
        optionsRoleElement.html(typeCustomOption);
      }
    });

    optionsRoleElement.on('change', (event: any) => {
      if (this.roleAtt?.choices) return;
      const target = $(event.target);
      const otherRoleSelected = target.val() === 'other' ? true : false;
      this.toggleOtherTypeTextField(otherRoleSelected);
    });

    //transfer value from 'other type 'textfied to 'other' option value on selectbox
    this.dialog.$el.find(`#${this.id}_personOtherRole`).on('change', () => {
      let val = this.dialog.$el.find(`#${this.id}_personOtherRole`).val();
      if (Array.isArray(val)) val = val[0];
      if (typeof val === 'number') val = val.toString();
      if (!val) return;

      this.dialog.$el.find(`#${this.id}_other`).attr('value', val);
    });

    personOtherRoleElement.on('keyup', (event: JQuery.KeyUpEvent) => {
      if (event.code === 'Space') {
        writer.dialogManager.confirm({
          title: 'Warning',
          msg: `
            Are you trying to add multiple values for this attribute?
            If not, remove the "space" you have just added
          `,
          height: 250,
          type: 'info',
          showConfirmKey: 'confirm-space-in-xml-values',
        });
      }
    });
  }

  private generateRoleOptions(choices: Role[]) {
    let html = '<option value="" disabled selected hidden>Please Choose...</option>';

    //empty choice
    html += '<option value=""></option>';

    //choices
    choices.forEach((choice) => {
      const value = typeof choice === 'string' ? choice : choice.value;
      const label = typeof choice === 'string' ? choice : choice.label;

      const defaultChoice = this.roleAtt?.defaultValue === value ? true : false;
      const selected = defaultChoice ? 'selected' : '';

      html += `
        <option
          value="${value}"
          data-default="${defaultChoice}"
          ${selected}
        >
        ${label}
        </option>
      `;
    });

    return html;
  }

  private toggleOtherTypeTextField = (show: boolean) => {
    this.dialog.$el.find(`#${this.id}_personOtherRoleSlot`).toggle(show);
    if (!show) this.dialog.$el.find(`#${this.id}_personOtherRole`).val('');
  };

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

        ${personTypeOptions
          .map((type) => {
            return `
              <input type="radio" id="${id}_${type}" name="${id}_type_certainty" value="${type}" />
              <label for="${id}_${type}" style="text-transform: capitalize;">${type}</label>
            `;
          })
          .join('\n')}
      </div>
    `;

    return html;
  }

  private personRoleField(id: string) {
    const fieldTitle = 'Role (optional)';

    const documentText: string | undefined =
      this.roleAtt?.documentation && capitalizeFirstLetter(this.roleAtt.documentation);

    const html = `
      <div class="attribute" style="display: flex; flex-direction: column; gap: 4px;">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>
        <select id="${id}_role" name="role" data-type="select" data-mapping="role"></select>
        ${documentText ? `<span style="font-size: 0.7rem; color: #666">${documentText}</span>` : ''}
      </div>
    `;

    return html;
  }

  private otherTypeField(id: string) {
    const fieldTitle = 'Define Role';

    return `
      <div id="${id}_personOtherRoleSlot" class="attribute">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>
        <input type="text" id="${id}_personOtherRole" data-type="textbox" data-mapping="otherRole" />
      </div>
    `;
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

export default PersonDialog;
