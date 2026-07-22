import $ from 'jquery';
import Entity from '../../../js/entities/Entity';
import Writer from '../../../js/Writer';
import type { EntityType, SchemaMappingType } from '../../../types';
import DialogForm from '../dialogForm/dialogForm';
import type { LWDialogConfigProps } from '../types';
import type { SchemaDialog } from './types';
import i18next from 'i18next';

type CorrectionKind = 'substitution' | 'supplied' | 'surplus';

const TAG_FOR_KIND: Record<CorrectionKind, string> = {
  substitution: 'choice',
  supplied: 'supplied',
  surplus: 'surplus',
};

const kindFromEntityTag = (tag?: string): CorrectionKind => {
  if (tag === 'supplied') return 'supplied';
  if (tag === 'surplus') return 'surplus';
  return 'substitution';
};

class CorrectionDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;
  readonly mappingID: SchemaMappingType;
  readonly formId: string;
  readonly $el: JQuery<HTMLElement>;

  entry?: Entity;
  selectedText?: string;
  type: EntityType = 'correction';

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    this.writer = writer;
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    this.mappingID = mappingID;
    this.formId = writer.getUniqueId('corrForm_');

    const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.correctionKindField(this.formId)}
        ${this.selectedTextField(this.formId)}
        ${this.correctionField()}
      </div>
    `;

    this.$el = $(`
      <div class="annotationDialog">
        <div class="content">
          <div class="main">
            ${entityAttributesSection}
          </div>
        </div>
      </div>
    `).appendTo(parentEl);

    this.dialog = new DialogForm({ writer, $el: this.$el, type: 'correction', title: 'Tag Correction' });

    // Orlando and cwrcEntry don't need these events
    if (this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry') return;

    this.$el.on('change', 'input[name="correctionKind"]', () => {
      this.syncFieldsForKind(this.getSelectedKind());
    });

    this.dialog.$el.on('beforeShow', (_event: JQuery.Event, config: any, dialog: DialogForm) => {
      const isQuick = !!config?.quick;
      this.$el.find('.quickCorrectionMode').toggle(isQuick);

      let sicText: string | undefined;

      if (dialog.mode === DialogForm.ADD) {
        const currentBookmark = this.writer.editor?.currentBookmark;
        if (!currentBookmark) return;

        if ('rng' in currentBookmark) {
          sicText = currentBookmark.rng.toString();
        }
      } else {
        sicText = config.entry.getCustomValue('sicText');
        if (!sicText && config.entry.getTag() === 'surplus') {
          sicText = config.entry.getContent();
        }
        if (!sicText) {
          const content = config.entry.getContent();
          this.$el.find('textarea').val(content);
        }
      }

      if (sicText !== undefined && sicText !== '') {
        dialog.currentData.customValues.sicText = sicText;
      }

      const defaultKind: CorrectionKind = isQuick
        ? sicText
          ? 'substitution'
          : 'supplied'
        : kindFromEntityTag(config.entry?.getTag());

      if (isQuick || config.entry) {
        dialog.currentData.customValues.correctionKind = defaultKind;
        this.$el.find(`input[name="correctionKind"][value="${defaultKind}"]`).prop('checked', true);
      }

      this.syncFieldsForKind(defaultKind);
    });

    let pendingSicText: string | undefined;
    let pendingTextNode: Node | undefined;

    this.dialog.$el.on('beforeSave', (_event: JQuery.Event, dialog: DialogForm) => {
      if (!writer.editor) return;

      const isQuick = !!dialog.showConfig?.quick;
      const kind = isQuick
        ? this.getSelectedKind()
        : kindFromEntityTag(dialog.showConfig?.entry?.getTag());

      const sicText = (dialog.currentData.customValues.sicText ?? '').trim();
      const corrText = (dialog.currentData.customValues.corrText ?? '').trim();

      dialog.currentData.customValues.correctionKind = kind;
      dialog.currentData.properties.tag = TAG_FOR_KIND[kind];

      if (kind === 'substitution') {
        if (!sicText || !corrText) {
          this.showValidationError(
            isQuick
              ? 'LW.Quick Correction requires selected text and a correction.'
              : 'LW.Tag Correction requires selected text and a correction.',
          );
          dialog.isValid = false;
          return;
        }
      } else if (kind === 'supplied') {
        if (!corrText) {
          this.showValidationError(
            isQuick
              ? 'LW.Quick Correction requires supplied text.'
              : 'LW.Supplied text is required.',
          );
          dialog.isValid = false;
          return;
        }
        delete dialog.currentData.customValues.sicText;
      } else if (kind === 'surplus') {
        if (!sicText) {
          this.showValidationError(
            isQuick
              ? 'LW.Quick Correction requires selected text to mark as surplus.'
              : 'LW.Select text to mark as surplus.',
          );
          dialog.isValid = false;
          return;
        }
        delete dialog.currentData.customValues.corrText;
      }

      if (dialog.mode === DialogForm.EDIT) {
        const entityId = writer.entitiesManager.getCurrentEntity();
        if (!entityId) return;

        const $entity = $(`#${entityId}`, writer.editor.getBody());
        const entity = writer.entitiesManager.getEntity(entityId);
        if (!$entity.length || !entity) return;

        if (kind === 'surplus') {
          $entity.text(sicText).removeAttr('data-sic-text');
          entity.setContent(sicText);
          return;
        }

        if (kind === 'supplied') {
          $entity.text(corrText).removeAttr('data-sic-text');
          entity.setContent(corrText);
          return;
        }

        $entity
          .text(corrText)
          .attr('data-sic-text', sicText);
        entity.setContent(corrText);

        return;
      }

      // DialogForm.ADD
      if (kind === 'surplus') {
        pendingSicText = undefined;
        pendingTextNode = undefined;
        return;
      }

      if (!corrText) {
        dialog.isValid = false;
        return;
      }

      const range = writer.editor.selection.getRng();

      if (range.collapsed) {
        const textNode = writer.editor.getDoc().createTextNode(corrText);
        range.insertNode(textNode);
        range.selectNodeContents(textNode);
        writer.editor.selection.setRng(range);
        writer.editor.currentBookmark = writer.editor.selection.getBookmark(1);
        pendingSicText = kind === 'substitution' ? sicText : undefined;
        pendingTextNode = textNode;
        return;
      }

      const tempId = writer.getUniqueId('temp');
      const $temp = $(`<span id="${tempId}"/>`, writer.editor.getDoc());

      if ($temp[0]) range.surroundContents($temp[0]);

      $temp.html(corrText);
      const textNode = $temp[0]?.firstChild;

      if (!textNode) {
        dialog.isValid = false;
        return;
      }

      $(textNode).unwrap();

      range.selectNodeContents(textNode);
      writer.editor.currentBookmark = writer.editor.selection.getBookmark(1);

      pendingSicText = kind === 'substitution' ? sicText : undefined;
      pendingTextNode = textNode;
    });

    this.dialog.$el.on('save', () => {
      if (!pendingTextNode || !writer.editor) return;

      const entitySpan = pendingTextNode.parentElement;
      if (entitySpan?.classList.contains('correction') && pendingSicText) {
        $(entitySpan).attr('data-sic-text', pendingSicText);
      }

      pendingSicText = undefined;
      pendingTextNode = undefined;
    });
  }

  private showValidationError(messageKey: string) {
    this.writer.dialogManager.show('message', {
      title: i18next.t('LW.Error'),
      msg: i18next.t(messageKey),
      type: 'error',
    });
  }

  private getSelectedKind(): CorrectionKind {
    const value = this.$el.find('input[name="correctionKind"]:checked').val();
    if (value === 'supplied' || value === 'surplus') return value;
    return 'substitution';
  }

  private syncFieldsForKind(kind: CorrectionKind) {
    const $selectedText = this.$el.find(`#${this.formId}_selectedText`);
    const $correctionField = this.$el.find('.correctionField');

    if (kind === 'supplied') {
      $selectedText.hide();
      $correctionField.show();
      $correctionField.find('.fieldLabel').text(i18next.t('LW.Supplied text'));
      return;
    }

    if (kind === 'surplus') {
      $selectedText.show();
      $correctionField.hide();
      return;
    }

    $selectedText.show();
    $correctionField.show();
    $correctionField.find('.fieldLabel').text(i18next.t('LW.Correction'));
  }

  private correctionKindField(id: string) {
    const label = i18next.t('LW.Correction type');

    return `
      <div id="${id}_mode" class="attribute quickCorrectionMode" style="display: none;">
        <p class="fieldLabel">${label}</p>
        <div data-type="radio" data-mapping="custom.correctionKind">
          <label>
            <input type="radio" name="correctionKind" value="substitution" data-default checked />
            ${i18next.t('LW.Substitute (sic/corr)')}
          </label>
          <label style="display: block; margin-top: 6px;">
            <input type="radio" name="correctionKind" value="supplied" />
            ${i18next.t('LW.Add (supplied)')}
          </label>
          <label style="display: block; margin-top: 6px;">
            <input type="radio" name="correctionKind" value="surplus" />
            ${i18next.t('LW.Delete (surplus)')}
          </label>
        </div>
      </div>
    `;
  }

  private selectedTextField(id: string) {
    const fieldTitle = i18next.t('LW.Selected Text');

    return `
      <div id="${id}_selectedText" class="attribute">
        <p class="fieldLabel">${fieldTitle}</p>
        <p class="selectedText">${this.selectedText}</p>
      </div>
    `;
  }

  private updateTextField(value: string) {
    const fontSize = value.length > 30 ? 1 : 1.2;
    this.$el.find('.selectedText').css('font-size', `${fontSize}em`);
    this.$el.find('.selectedText').text(value);
  }

  private correctionField() {
    const fieldTitle = i18next.t('LW.Correction');

    const dataMapping =
      this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
        ? 'CORR'
        : 'custom.corrText';

    return `
      <div class="attribute correctionField">
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
      selection = selection.trim().replace(/\s+/g, ' ');
      return selection;
    }
    return;
  }

  show(config?: { [x: string]: any; entry: Entity; quick?: boolean }) {
    this.entry = config?.entry ? config.entry : undefined;
    this.selectedText = config?.entry ? config.entry.content : this.getSelection();

    this.updateTextField(this.selectedText ?? '');

    if (config?.quick) {
      //@ts-ignore
      this.dialog.$el.dialog('option', 'title', i18next.t('LW.editorToolbar.Correction'));
    } else {
      //@ts-ignore
      this.dialog.$el.dialog('option', 'title', i18next.t('LW.editorToolbar.Tag Correction'));
    }

    this.dialog.show(config);
  }

  destroy() {
    this.dialog.destroy();
  }
}

export default CorrectionDialog;
