import { iso6392 } from 'iso-639-2';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/dialog';
import Writer from '../Writer';
import AttributeWidget from './attributeWidget/attributeWidget';
import type { LWDialogConfigProps, LWDialogProps } from './types';

class Translation implements LWDialogProps {
  readonly writer: Writer;
  readonly $el: JQuery<HTMLElement>;
  readonly id: string;
  readonly attributesWidget: AttributeWidget;

  // TODO hardcoded
  readonly tagName: string = 'div';
  readonly textParentTagName: string = 'p';
  readonly langAttribute: string = 'xml:lang';
  readonly respAttribute: string = 'resp';

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    this.writer = writer;
    this.id = writer.getUniqueId('translation_');

    const entityAttributesSection = `
    <div class="entityAttributes">
      ${this.languageSelectField(this.id)}
      ${this.responsabilityField(this.id)}
      ${this.translationField(this.id)}
    </div>
  `;

    this.$el = $(`
    <div class="annotationDialog">
      <div class="schemaHelp" />
        <div class="content">
          <div class="main">
            ${entityAttributesSection}
            
            <hr style="width: 100%; border: none; border-bottom: 1px solid #ccc;">

            <div class="attributeWidget" />
          </div>

          <div class="attributeSelector">
            <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 4px;">Markups</h3>
            <ul></ul>
          </div>

        </div>
      </div>`).appendTo(parentEl);

    //@ts-ignore
    this.$el.dialog({
      title: 'Tag Translation',
      modal: true,
      resizable: true,
      closeOnEscape: true,
      height: 650,
      width: 575,
      autoOpen: false,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          //@ts-ignore
          click: () => this.$el.dialog('close'),
        },
        {
          text: 'Ok',
          role: 'ok',
          click: () => {
            this.formResult();
            //@ts-ignore
            this.$el.dialog('close');
          },
        },
      ],
      open: (event: JQuery.Event) => {},
      close: (event: JQuery.Event) => {},
    });

    const langOptions = iso6392.reduce((result: { name: string; value: string }[], lang) => {
      const value = lang.iso6391; //lang.iso6392T === undefined ? lang.iso6392B : lang.iso6392T
      const name = lang.name;
      if (value !== undefined) result.push({ name, value });
      return result;
    }, []);

    langOptions.sort((a, b) => {
      if (a.name > b.name) return 1;
      if (a.name < b.name) return -1;
      return 0;
    });

    const options = langOptions
      .map((lang) => {
        return `<option value="${lang.value}">${lang.name}</option>`;
      })
      .join('\n');

    $(`#${this.id}_lang`).html(options);

    this.attributesWidget = new AttributeWidget({
      writer,
      $parent: this.$el,
      $el: this.$el.find('.attributeWidget'),
      showSchemaHelp: true,
    });

    $(`#${this.id}_lang`).on('change', (event) => {
      //@ts-ignore
      const value = event.target.value;
      this.attributesWidget.setAttribute(this.langAttribute, value);
    });

    $(`#${this.id}_resp`).on('change', (event) => {
      //@ts-ignore
      event.target.checked
        ? this.attributesWidget.setAttribute(this.respAttribute, this.writer.getUserInfo().name)
        : this.attributesWidget.setAttribute(this.respAttribute, undefined);
    });
  }

  private languageSelectField(id: string) {
    const fieldTitle = 'Language';

    const html = `
      <div class="attribute">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        <select id="${id}_lang"></select>
      </div>
    `;

    return html;
  }

  private responsabilityField(id: string) {
    const fieldTitle = 'Add Responsibility';

    const html = `
      <div class="attribute">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        <input id="${id}_resp" type="checkbox" />
      </div>
    `;

    return html;
  }

  private translationField(id: string) {
    const fieldTitle = 'Translation text';

    const html = `
      <div class="attribute">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        <textarea id="${id}_trans" style="width: 100%; height: 100px;" spellcheck="false">
        </textarea>
        <p style="font-size: 0.7rem; color: #666;">
          You will be able to tag and edit the text in the main document.
        </p>
      </div>
    `;

    return html;
  }

  private formResult() {
    let translation = $(`#${this.id}_trans`).val();
    if (Array.isArray(translation)) translation = translation[0];
    if (typeof translation === 'number') translation = translation.toString();
    if (!translation) return;

    const attributes = this.attributesWidget.getData();

    //@ts-ignore
    const currTagId = this.writer.tagger.getCurrentTag().attr('id');

    const newTag = this.writer.tagger.addStructureTag({
      action: this.writer.tagger.AFTER,
      attributes,
      bookmark: { tagId: currTagId },
      tagName: this.tagName,
    });

    const textTag = this.writer.tagger.addStructureTag({
      action: this.writer.tagger.INSIDE,
      attributes: {},
      bookmark: { tagId: newTag?.id },
      tagName: this.textParentTagName,
    });

    if (!textTag) return;

    $(textTag).html(translation);
  }

  show() {
    //@ts-ignore
    const currTag = this.writer.tagger.getCurrentTag().attr('_tag');
    if (currTag !== this.tagName) {
      this.writer.dialogManager.show('message', {
        title: 'Translation',
        msg: `Please select a ${this.tagName} tag to translate.`,
        type: 'info',
      });
      return;
    }

    const $resp = $(`#${this.id}_resp`);
    const hasResp = this.writer.schemaManager.isAttributeValidForTag(
      this.respAttribute,
      this.tagName
    );
    hasResp ? $resp.parent().show() : $resp.parent().hide();

    $resp.prop('checked', false);

    let firstLang = $(`#${this.id}_lang > option:eq(0)`).val();

    if (Array.isArray(firstLang)) firstLang = firstLang[0];
    if (typeof firstLang === 'number') firstLang = firstLang.toString();
    if (!firstLang) return;

    $(`#${this.id}_lang`).val(firstLang);
    $(`#${this.id}_trans`).val('');

    this.attributesWidget.mode = AttributeWidget.ADD;
    const atts = this.writer.schemaManager.getAttributesForTag(this.tagName);

    const initVals: { type: string; langAttribute: string } = {
      type: 'translation', // TODO hardcoded
      langAttribute: firstLang,
    };

    this.attributesWidget.buildWidget(atts, initVals, this.tagName);

    //@ts-ignore
    this.$el.dialog('open');
  }

  destroy() {
    //@ts-ignore
    this.$el.dialog('destroy');
  }
}

// module.exports = Translation;
export default Translation;
