import $ from 'jquery';
import type { DialogBarProps } from '../../dialogs';
import '../../lib/jquery/jquery.popup';
import Writer from '../Writer';
import { log } from './../../utilities';
import type { LWDialogConfigProps, LWDialogProps } from './types';

class Popup implements LWDialogProps {
  readonly writer: Writer;
  readonly $popupEl: JQuery<HTMLElement>;

  $currentTag: JQuery | null = null;
  popupCloseId: any = null;
  linkSelector = '';

  constructor({ writer, parentEl }: LWDialogConfigProps) {
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
      open: (_event: JQuery.Event, _ui: any) => {
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
            $popupEl.outerWidth(),
          );

          const y = _this.writer.utilities.constrain(
            topLeft.top,
            $docBody.height() ?? 0,
            $popupEl.outerHeight(),
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

    // ? Use to create popups for tags with links (entities with 'ref' and actual links)
    const urlKeys = this.writer.schemaManager.mapper.getUrlAttributes();

    this.linkSelector = urlKeys.length > 0 ? urlKeys.map((value) => `[${value}]`).join(',') : '';

    if (this.linkSelector !== '') {
      body.on('click', this.linkSelector, (event: JQuery.Event) => this.entityShowPopupLink(event));
      body.on('mouseout', this.linkSelector, (event: JQuery.Event) => this.entityMouseOut(event));
    }
  }

  private setCurrentTag(id: string) {
    const editor = this.writer.editor;
    if (!editor) return;

    this.$currentTag = $(`#${id}`, editor.getBody());
    if (this.$currentTag.length == 0) {
      this.$currentTag = $(`[name="${id}"]`, editor.getBody()).first();
    }
  }

  private entityShowPopupLink(event: JQuery.Event) {
    //@ts-ignore
    const target: HTMLElement = event.target;

    const entityId = target.getAttribute('id') || target.getAttribute('name');

    if (!entityId) return;

    this.setCurrentTag(entityId);

    // ! Deprecated
    const urlKeys = this.writer.schemaManager.mapper.getUrlAttributes();

    let url = null;

    for (const urlKey of urlKeys) {
      url = target.getAttribute(urlKey);
      if (url) break;
    }

    if (!url) return;

    //remove previous popups
    this.writer.overmindState.ui.dialogBar.forEach(({ props }: DialogBarProps) => {
      if (props?.id?.includes('dom_')) {
        this.writer.overmindActions.ui.closeDialog(props.id);
      }
    });

    const isLink = url.startsWith('http');
    const entityType = target.getAttribute('_type');

    this.writer.overmindActions.ui.openDialog({
      type: 'popup',
      props: {
        id: target.getAttribute('id'),
        content: url,
        isLink,
        closeOnMouseOutTarget: true,
        entityType,
      },
    });
  }

  private entityMouseOut(event: JQuery.Event) {
    //@ts-ignore
    const targetId = event.target.getAttribute('id');
    if (!targetId) return;

    setTimeout(() => {
      const dialogBar: DialogBarProps = this.writer.overmindState.ui.dialogBar.find(
        ({ props }: DialogBarProps) => props?.id === targetId,
      );
      if (!dialogBar) return;

      //@ts-ignore
      if (dialogBar?.props?.closeOnMouseOutTarget) {
        this.writer.overmindActions.ui.closeDialog(targetId);
      }
    }, 1000);
  }

  private removeListeners() {
    const editor = this.writer.editor;
    if (!editor) return;
  }

  show() {
    log.warn("dialogManager.popup: shouldn't call show directly");
  }

  destroy() {
    this.removeListeners();
  }
}

export default Popup;
