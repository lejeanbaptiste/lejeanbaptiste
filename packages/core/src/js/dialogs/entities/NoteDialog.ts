import { MappingID } from '../../../@types';
import $ from 'jquery';
import DialogForm from '../dialogForm/dialogForm';
import Writer from '../../Writer';
import type { ILWDialogConfigParams } from '../types';
import { SchemaDialog } from './types';
import Entity from '../../../js/entities/Entity';
import { EntityTypes } from '../../../js/schema/types';

interface IOption {
  label: string;
  title: string;
  value: string;
}

class NoteDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;

  readonly id: string;
  readonly mappingID: MappingID;
  readonly typeAtt: any;

  entry?: Entity;
  selectedText?: string;
  type: EntityTypes = 'note';

  constructor({ writer, parentEl }: ILWDialogConfigParams) {
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    this.writer = writer;
    this.mappingID = mappingID;
    this.id = writer.getUniqueId('noteForm_');

    const atts = writer.schemaManager.getAttributesForTag(this.type);
    
    this.typeAtt = atts.find(({ name }) => name === 'type');

    const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.noteTypeField(this.id)}
        ${this.otherTypeField(this.id)}
        ${this.noteTextField(this.id)}
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
            <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 4px;">Markups</h3>
            <ul></ul>
          </div>
        </div>
      </div>
    `;

    const $el = $(html).appendTo(parentEl);

    this.dialog = new DialogForm({ writer, $el, type: this.type, title: 'Tag Note' });

    const optionsTypeElement = this.dialog.$el.find(`#${this.id}_type`);
    const noteOtherTypeElement = this.dialog.$el.find(`#${this.id}_noteOtherType`);

    //dialog events
    this.dialog.$el.on(
      'buildDynamicFields',
      (event: JQuery.Event, config: any, dialog: DialogForm) => {
        const typeChoices = this.typeAtt?.choices ? this.typeAtt.choices : this.setTypeOptions();
        const choiceOptions = this.generateTypeOptions(typeChoices);
        optionsTypeElement.html(choiceOptions);
      }
    );

    this.dialog.$el.on('beforeShow', (event: JQuery.Event, config: any, dialog: DialogForm) => {
      const show = dialog.mode === DialogForm.EDIT;
      dialog.$el.find(`label[for=${this.id}_noteContent]`).toggle(!show);
      dialog.$el.find(`#${this.id}_noteContent`).toggle(!show);

      //other type
      const typeValue = optionsTypeElement.val();
      const showOtherTypeTextFiel = !this.typeAtt?.choices && typeValue === 'other' ? true : false;
      this.toggleOtherTypeTextField(showOtherTypeTextFiel);
    });

    this.dialog.$el.on('beforeSave', (event: JQuery.Event, dialog: DialogForm) => {
      //test type value
      const typeValue = dialog.$el.find(`#${this.id}_type`).val();
      dialog.isValid = !!this.typeRequired() && typeValue === null ? false : true;

      if (!dialog.isValid) {
        writer.dialogManager.show('message', {
          title: 'Warning',
          msg: 'You must choose a Note type',
          height: 150,
          type: 'info',
        });
        return;
      }

      //replace other type option for custom defined value
      if (!this.typeAtt?.choices && optionsTypeElement.val() === 'other') {
        const otherTypeFieldValue = dialog.$el.find(`#${this.id}_noteOtherType`).val();
        const typeCutstomOption = `
          <option value="${otherTypeFieldValue}" selected>${otherTypeFieldValue}</option>
        `;
        optionsTypeElement.html(typeCutstomOption);
      }
    });

    //toggle other type text field
    optionsTypeElement.change((event: any) => {
      if (this.typeAtt?.choices) return;
      const target = $(event.target);
      const otherTypeSelected = target.val() === 'other' ? true : false;
      this.toggleOtherTypeTextField(otherTypeSelected);
    });

    //transfer value from 'other type 'textfied to 'other' option value on radiobox
    this.dialog.$el.find(`#${this.id}_noteOtherType`).on('change', () => {
      let val = this.dialog.$el.find(`#${this.id}_noteOtherType`).val();
      if (!val) return;
      if (Array.isArray(val)) val = val[0];
      if (typeof val === 'number') val = val.toString();

      this.dialog.$el.find(`#${this.id}_other`).attr('value', val);
    });

    noteOtherTypeElement.on('keyup', (event: JQuery.KeyUpEvent) => {
      if (event.code === 'Space') {
        writer.dialogManager.confirm({
          title: 'Warning',
          msg: `
            Are you trying to add multiple values for this attribute?
            If not, remove the "space" you've just added
          `,
          height: 200,
          type: 'info',
          showConfirmKey: 'confirm-space-in-xml-values',
        });
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

  private generateTypeOptions(choices: IOption[]) {
    let html = '<option value="" disabled selected hidden>Please Choose...</option>';

    //empty choice
    if (this.mappingID !== 'orlando' && this.mappingID !== 'cwrcEntry') {
      html += '<option value=""></option>';
    }

    //choices
    choices.map((choice) => {
      const value = typeof choice === 'string' ? choice : choice.value;
      const label = typeof choice === 'string' ? choice : choice.label;

      const defaultChoice = this.typeAtt?.defaultValue === value ? true : false;
      const selected = defaultChoice ? 'selected' : '';

      html += `
        <option value="${value}" data-default="${defaultChoice}" ${selected}>${label}</option>
        `;
    });

    return html;
  }

  private toggleOtherTypeTextField = (show: boolean) => {
    this.dialog.$el.find(`#${this.id}_noteOtherTypeSlot`).toggle(show);
    if (!show) this.dialog.$el.find(`#${this.id}_noteOtherType`).val('');
  };

  private setTypeOptions = () => {
    const mappingID = this.writer.schemaManager.mapper.currentMappingsId;
    let options: IOption[];

    if (mappingID === 'orlando' || mappingID === 'cwrcEntry') {
      options = [
        { value: 'RESEARCHNOTE', label: 'Research Note', title: 'Internal to projects' },
        { value: 'SCHOLARNOTE', label: 'Scholarly Note', title: 'Footnotes/endnotes' },
      ];
    } else {
      options = [
        { value: 'researchNote', label: 'Research Note', title: 'Internal to projects' },
        { value: 'scholarNote', label: 'Scholarly Note', title: 'Footnotes/endnotes' },
        { value: 'annotation', label: 'Annotation', title: 'Informal notes' },
        { value: 'other', label: 'Other', title: 'Other Notes' },
      ];
    }

    return options;
  };

  private typeDataMapping = () => {
    if (this.mappingID === 'orlando' || this.mappingID === 'cwrcEntry') return 'prop.tag';
    return 'type';
  };

  private typeRequired = () => {
    const mappingID = this.writer.schemaManager.mapper.currentMappingsId;
    if (mappingID === 'orlando' || mappingID === 'cwrcEntry') return 'required';
    return this.typeAtt?.required ? 'required' : '';
  };

  private noteTypeField(id: string) {
    const fieldTitle = 'Type';

    const html = `
      <div class="attribute type">
        <div>
          <p class="fieldLabel">${fieldTitle}${this.typeRequired() && '*'}</p>
        </div>

        <select
            id="${id}_type"
            name="${id}_type"
            data-type="select"
            data-mapping="${this.typeDataMapping()}" ${this.typeRequired()}
          >
        </select>
      </div>
    `;

    return html;
  }

  private otherTypeField(id: string) {
    const fieldTitle = 'Define Type';

    return `
      <div id="${id}_noteOtherTypeSlot" class="attribute">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        <input type="text" id="${id}_noteOtherType" data-type="textbox" data-mapping="otherType" />
      </div>
    `;
  }

  private noteTextField(id: string) {
    const fieldTitle = 'Note text';

    const html = `
      <div class="attribute">
        <p class="fieldLabel">${fieldTitle}</p>
       
        <textarea
          id="${id}_noteContent"
          data-type="textbox"
          data-mapping="prop.noteContent"
          style=" width: 100%; padding: 8px; border-radius: 4px; border-color: #bbb;"
        >
        </textarea>

        <p style="font-size: 0.7rem; color: #666;">
          You will be able to tag and edit the text in the main document.
        </p>
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
    this.entry = config?.entry ?? undefined;
    // this.selectedText = config.entry ? config.entry.content : this.getSelection();
    // this.updateTextField(this.selectedText ?? '');

    this.dialog.show(config);
  }

  destroy() {
    this.dialog.destroy();
  }
}

export default NoteDialog;
