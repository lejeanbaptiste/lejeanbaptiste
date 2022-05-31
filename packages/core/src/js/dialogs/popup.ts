import $ from 'jquery';
import '../../lib/jquery/jquery.popup';
import Writer from '../Writer';
import { log } from './../../utilities';
import type { ILWDialog, ILWDialogConfigParams } from './types';

class Popup implements ILWDialog {
  readonly writer: Writer;
  readonly noteMouseoverSelector = '.noteWrapper.hide';
  readonly noteClickSelector = '.noteWrapper'; // need a different selector because tagger.addNoteWrapper click event fires before this one (and removes hide class)
  readonly $popupEl: JQuery<HTMLElement>;

  $currentTag: JQuery | null = null;
  popupCloseId: any = null;
  linkSelector: string = '';

  attributeSelector: string = '';

  constructor({ writer, parentEl }: ILWDialogConfigParams) {
    this.writer = writer;

    const popupId = this.writer.getUniqueId('popupDialog');
    this.$popupEl = $(`<div id="${popupId}"></div>`).appendTo(parentEl);

    const _this = this;

    //@ts-ignore
    this.$popupEl.popup({
      autoOpen: false,
      resizable: false,
      draggable: false,
      minHeight: 30,
      minWidth: 40,
      open: (event: JQuery.Event, ui: any) => {
        this.$popupEl.parent().find('.ui-dialog-titlebar-close').hide();
      },
      position: {
        my: 'center',
        at: 'center',
        of: this.$currentTag,
        using: function (topLeft: any, posObj: any) {
          const editor = _this.writer.editor;
          if (!editor) return;

          const $popupEl = posObj.element.element;
          const $editorBody = $(editor.getDoc().documentElement);
          const $docBody = $(document.documentElement);

          const tagOffset = _this.$currentTag?.offset();

          //@ts-ignore
          const frameOffset = $(editor.iframeElement).offset();
          const editorScrollTop = $editorBody.scrollTop();
          const editorScrollLeft = $editorBody.scrollLeft();
          const docScrollTop = $docBody.scrollTop();
          const docScrollLeft = $docBody.scrollLeft();

          if (
            !frameOffset ||
            !tagOffset ||
            !_this.$currentTag?.height() ||
            !editorScrollTop ||
            !docScrollTop ||
            !editorScrollLeft ||
            !docScrollLeft
          ) {
            return;
          }

          topLeft.top =
            frameOffset.top +
            tagOffset.top +
            (_this.$currentTag.height() ?? 0) -
            editorScrollTop -
            docScrollTop;
          topLeft.left = frameOffset.left + tagOffset.left - editorScrollLeft - docScrollLeft;

          const x = _this.writer.utilities.constrain(
            topLeft.left,
            $docBody.width() ?? 0,
            $popupEl.outerWidth()
          );

          const y = _this.writer.utilities.constrain(
            topLeft.top,
            $docBody.height() ?? 0,
            $popupEl.outerHeight()
          );

          $popupEl.css({ left: `${x}px`, top: `${y}px` });
        },
      },
    });

    this.writer.event('schemaLoaded').subscribe(() => this.setupListeners());
  }

  private setupListeners() {
    this.removeListeners();

    const editor = this.writer.editor;
    if (!editor) return;

    const body = $(editor.getBody());

    // ! Deprecated
    // const attKeys = this.writer.schemaManager.mapper.getPopupAttributes();
    // this.attributeSelector = '';

    // $.map(attKeys, (val, i) => {
    //   this.attributeSelector += `[${val}]`;
    //   if (i < attKeys.length - 1) this.attributeSelector += ',';
    // });

    // if (this.attributeSelector !== '') {
    //   body.on('mouseover', this.attributeSelector, (event: JQuery.Event) =>
    //     this.attributeMouseover(event)
    //   );
    // }

    // ! Deprecated
    // const urlKeys = this.writer.schemaManager.mapper.getUrlAttributes();
    // this.linkSelector = '';

    // $.map(urlKeys, (val, i) => {
    //   this.linkSelector += `[${val}]`;
    //   if (i < urlKeys.length - 1) this.linkSelector += ',';
    // });

    // if (this.linkSelector !== '') {
    //   body.on('mouseover', this.linkSelector, (event: JQuery.Event) => this.linkMouseover(event));
    // }

    // ! Deprecated
    // body.on('mouseover', this.noteMouseoverSelector, (event: JQuery.Event) =>
    //   this.noteMouseover(event)
    // );

    // body.on('click', this.noteClickSelector, (event: JQuery.Event) => this.noteClick(event));

    // ! Deprecated
    body.on('contextmenu', () => this.hidePopup());
  }

  private setCurrentTag(id: string) {
    const editor = this.writer.editor;
    if (!editor) return;

    this.$currentTag = $(`#${id}`, editor.getBody());
    if (this.$currentTag.length == 0) {
      this.$currentTag = $(`[name="${id}"]`, editor.getBody()).first();
    }
  }

  private doMouseOver() {
    clearTimeout(this.popupCloseId);
  }

  private doMouseOut() {
    this.popupCloseId = setTimeout(() => this.hidePopup(), 500);
  }

  private doClick() {
    const url = this.$popupEl.text();
    window.open(url);
  }

  /**
   * Show the content in the popup element
   * @param {String|Element} content The content to show
   * @param {String} type The entity type
   */
  private doPopup(content: string | JQuery<HTMLElement>, type: 'tag' | 'link' | 'note') {
    const editor = this.writer.editor;
    if (!editor) return;

    this.$popupEl.parent().off('mouseover', () => this.doMouseOver());
    this.$popupEl.parent().off('mouseout', () => this.doMouseOut());
    this.$popupEl.off('click', () => this.doClick());

    //@ts-ignore
    this.$popupEl.popup('option', 'dialogClass', `popup ${type}`);

    typeof content === 'string' ? this.$popupEl.html(content) : this.$popupEl.append(content);

    //@ts-ignore
    this.$popupEl.popup('open');

    let width;
    if (type === 'note') {
      width = 350;
    } else {
      //@ts-ignore
      this.$popupEl.popup('option', 'width', 'auto');
      const textWidth = this.$popupEl.width() ?? 0;
      width = type === 'link' ? textWidth + 30 : Math.min(200, textWidth) + 30;
    }

    //@ts-ignore
    this.$popupEl.popup('option', 'width', width);

    clearTimeout(this.popupCloseId);

    this.$currentTag?.on('mouseout', () => {
      this.popupCloseId = setTimeout(() => this.hidePopup(), 1000);
    });

    this.$popupEl.parent().on('mouseover', () => this.doMouseOver());
    this.$popupEl.parent().on('mouseout', () => this.doMouseOut());

    const currentTagRect = this.$currentTag?.[0].getBoundingClientRect();
    const editorRect = editor?.editorContainer.getBoundingClientRect();

    const mceToolbarHeight = $('.tox-toolbar-overlord').height() ?? 0;

    const position = {
      left: editorRect.left + (currentTagRect?.left || 0),
      top: editorRect.top + mceToolbarHeight + (currentTagRect?.bottom || 0),
    };

    this.writer.overmindActions.ui.openPopup({ content, position, isLink: type === 'link' });
  }

  private attributeMouseover(event: JQuery.Event) {
    //@ts-ignore
    const target = event.target;

    const popupId = target.getAttribute('id') || target.getAttribute('name');
    this.setCurrentTag(popupId);

    // ! Deprecated
    // const popKeys = this.writer.schemaManager.mapper.getPopupAttributes();
    // let popText = null;

    // for (let i = 0; i < popKeys.length; i++) {
    //   const popAtt = this.$currentTag?.attr(popKeys[i]);
    //   if (popAtt) {
    //     popText = popAtt;
    //     break;
    //   }
    // }

    // if (popText) this.doPopup(popText, 'tag');
  }

  private linkMouseover(event: JQuery.Event) {
    //@ts-ignore
    const target = event.target;

    const entityId = target.getAttribute('id') || target.getAttribute('name');
    this.setCurrentTag(entityId);

    // ! Deprecated
    // const urlKeys = this.writer.schemaManager.mapper.getUrlAttributes();
    // let url = null;

    // for (let i = 0; i < urlKeys.length; i++) {
    //   const urlAtt = this.$currentTag?.attr(urlKeys[i]);
    //   if (urlAtt) {
    //     url = urlAtt;
    //     break;
    //   }
    // }

    // if (url) this.showLink(url);
  }

  private showLink(url: string | JQuery<HTMLElement>) {
    if (typeof url === 'string' && url.indexOf('http') === 0) {
      this.doPopup(url, 'link');
      this.$popupEl.on('click', () => this.doClick());
    } else {
      this.doPopup(url, 'tag');
    }
  }

  private noteMouseover(event: JQuery.Event) {
    //@ts-ignore
    const target = event.target;

    this.$currentTag = $(target);
    const entity = $(target).children('[_entity]');
    const entityId = entity.attr('id');

    if (!entityId) return;

    const entry = this.writer.entitiesManager.getEntity(entityId);

    const hasTextContent = target.textContent.match(/\S+/) !== null;

    if (!hasTextContent) {
      if (entry.getType() === 'citation') {
        const url = entry.getURI();
        if (url) this.showLink(url);
      }
      return;
    }

    const content = entry.getNoteContent() ?? entry.getContent();
    if (!content) return;

    this.doPopup(content, 'note');
  }

  private noteClick(event: JQuery.Event) {
    // we're showing the note contents so hide the popup
    this.hidePopup();
  }

  private hidePopup() {
    //@ts-ignore
    this.$popupEl.popup('close');

    this.writer.overmindActions.ui.closePopup();
  }

  private removeListeners() {
    const editor = this.writer.editor;
    if (!editor) return;

    const body = $(editor.getBody());

    // ! Deprecated
    // body.off('mouseover', this.attributeSelector, (event: JQuery.Event) =>
    //   this.attributeMouseover(event)
    // );
    // body.off('mouseover', this.linkSelector, (event: JQuery.Event) => this.linkMouseover(event));
    // body.off('mouseover', this.noteMouseoverSelector, (event: JQuery.Event) =>
    //   this.noteMouseover(event)
    // );
    // body.off('click', this.noteClickSelector, (event: JQuery.Event) => this.noteClick(event));
    // body.off('contextmenu', () => this.hidePopup());
  }

  show() {
    log.warn("dialogManager.popup: shouldn't call show directly");
  }

  destroy() {
    this.removeListeners();
  }
}

export default Popup;
