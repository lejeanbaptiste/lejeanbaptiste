import $ from 'jquery';
import Writer from '../../Writer';
import AttributeWidget from '../attributeWidget/attributeWidget';
import type { LWDialogConfigProps, LWDialogProps } from '../types';
import { log } from './../../../utilities';
class AttributesEditor implements LWDialogProps {
  readonly writer: Writer;
  readonly $schemaDialog: JQuery<HTMLElement>;
  readonly attributesWidget: AttributeWidget;

  currentCallback: Function | null = null;

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    this.writer = writer;

    this.$schemaDialog = $(`
      <div class="annotationDialog">

       ${this.warningAlertComponent()}

        <div class="schemaHelp" />
        
        <div class="content">

          <div class="main">
            ${this.hintComponent()}
            <div class="attributeWidget" />
          </div>
            
          <div class="attributeSelector">
            <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 4px;">Markups</h3>
            <ul></ul>
          </div>

        </div>

      </div>
    `).appendTo(parentEl);

    let dialogOpenTimestamp = 0;

    //@ts-ignore
    this.$schemaDialog.dialog({
      modal: true,
      resizable: true,
      dialogClass: 'splitButtons',
      closeOnEscape: false,
      height: 650, //460,
      width: 575, //550,
      position: { my: 'center', at: 'center', of: writer.layoutManager.getContainer() },
      minHeight: 400,
      minWidth: 510,
      autoOpen: false,
      open: (event: JQuery.Event, ui: any) => {
        dialogOpenTimestamp = event.timeStamp;
        this.$schemaDialog.parent().find('.ui-dialog-titlebar-close').hide();
      },
      beforeClose: (event: JQuery.Event, ui: any) => {
        // if the dialog was opened then closed immediately it was unintentional
        if (event.timeStamp - dialogOpenTimestamp < 150) return false;
      },
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          click: () => this.cancel(),
        },
        {
          text: 'Ok',
          role: 'ok',
          click: () => this.formResult(),
        },
      ],
    });

    this.attributesWidget = new AttributeWidget({
      writer,
      $parent: this.$schemaDialog,
      $el: this.$schemaDialog.find('.attributeWidget'),
      showSchemaHelp: true,
    });
  }

  private hintComponent = () => {
    return `
      <p
        class="hint"
        style="
            margin-top: 28px;
            color: #666;
            text-align: center;
            font-size: 1.2em;
            font-weight: 600;
          "
      >
        Select an attribute in the side panel
      </p>
    `;
  };

  private toggleHintComponent = (show?: boolean) => {
    if (!show) {
      const attributesUsed = $('.attsContainer div.attribute', this.$schemaDialog).filter(
        (i, li) => $(li).is(':visible') == true,
      );
      show = attributesUsed.length === 0 ? true : false;
    }

    const $hint = $(`.hint`, this.$schemaDialog);
    show ? $hint.show() : $hint.hide();
  };

  private warningAlertComponent = () => {
    return `
      <div class="entityWarning" style="display: none;">
        <div>
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div>
          You are creating a tag but <em>not</em> a corresponding entity/linked data annotation.
          Use the button on the tool bar to create a tag and an entity simultaneously.
        </div>
      </div>
      `;
  };

  private formResult() {
    // collect values then close dialog
    let attributes = this.attributesWidget.getData();
    if (!attributes) attributes = {}; // let form submit even if invalid (for now)

    //@ts-ignore
    this.$schemaDialog.dialog('close');

    // check if beforeClose cancelled or not
    if (this.$schemaDialog.is(':hidden')) {
      try {
        //@ts-ignore
        $('ins', this.$schemaDialog).tooltip('destroy');
      } catch (e) {
        log.info('error destroying tooltip');
      }

      this.currentCallback?.call(this.writer, attributes);
      this.currentCallback = null;
    }
  }

  private cancel() {
    if (!this.writer.editor) return;
    //@ts-ignore
    this.$schemaDialog.dialog('close');

    // check if beforeClose cancelled or not
    if (this.$schemaDialog.is(':hidden') && this.writer.editor.currentBookmark) {
      this.writer.editor.selection.moveToBookmark(this.writer.editor.currentBookmark);
      // // writer.editor.currentBookmark = null;
      try {
        //@ts-ignore
        $('ins', this.$schemaDialog).tooltip('destroy');
      } catch (e) {
        log.info('error destroying tooltip');
      }

      this.currentCallback?.call(this.writer, null);
      this.currentCallback = null;
    }
  }

  private doShow({
    attributes,
    tagFullname,
    tagName,
    tagPath,
  }: {
    attributes: object;
    tagFullname?: string;
    tagName: string;
    tagPath: string;
  }) {
    this.writer.editor?.getBody().blur(); // lose keyboard focus in editor

    this.$schemaDialog.find('.entityWarning').hide();

    if (this.writer.mode !== this.writer.XML) {
      const type = this.writer.schemaManager.mapper.getEntityTypeForTag(tagName);
      if (type) this.$schemaDialog.find('.entityWarning').show();
    }

    $.isEmptyObject(attributes)
      ? (this.attributesWidget.mode = AttributeWidget.ADD)
      : (this.attributesWidget.mode = AttributeWidget.EDIT);

    const atts = tagPath
      ? this.writer.schemaManager.getAttributesForPath(tagPath)
      : this.writer.schemaManager.getAttributesForTag(tagName);

    this.attributesWidget.buildWidget(atts, attributes, tagName);

    const title = tagFullname ? `${tagName} ${tagFullname}` : tagName;
    //@ts-ignore
    this.$schemaDialog.dialog('option', 'title', title);
    //@ts-ignore
    this.$schemaDialog.dialog('open');

    // TODO contradicting focuses
    $('button[role=ok]', this.$schemaDialog.parent()).trigger('focus');
    // //$('input, select', $schemaDialog).first().focus();
  }

  /**
   * Show the attributes editor
   * @param {String} tagName The tag name
   * @param {String} tagName The tag fullname
   * @param {String} tagPath The xpath for the tag
   * @param {Object} attributes Attributes previously added to tag (for use when editing)
   * @param {Function} callback Callback function. Called with attributes object, or null if cancelled.
   */
  // show(tagName: string, tagPath: string, attributes: object, callback: Function) {
  show({
    attributes,
    callback,
    tagFullname,
    tagName,
    tagPath,
  }: {
    attributes: object;
    callback: Function;
    tagFullname?: string;
    tagName: string;
    tagPath: string;
  }) {
    this.currentCallback = callback;
    this.doShow({ attributes, tagFullname, tagName, tagPath });

    $('.attributeSelector li', this.$schemaDialog).on('click', () => {
      this.toggleHintComponent();
    });

    this.toggleHintComponent();
  }

  destroy() {
    $('.attributeSelector li', this.$schemaDialog).off('click', () => {
      this.toggleHintComponent();
    });

    this.attributesWidget.destroy();
    //@ts-ignore
    this.$schemaDialog.dialog('destroy');
  }
}

export default AttributesEditor;
