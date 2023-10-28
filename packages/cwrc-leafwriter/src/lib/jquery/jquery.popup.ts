import $ from 'jquery';
import 'jquery-ui/ui/widgets/dialog';

//@ts-ignore
$.widget('custom.popup', $.ui.dialog, {
  version: '1.10.4',
  close: function (event: JQuery.Event) {
    if (!this._isOpen || this._trigger('beforeClose', event) === false) {
      return;
    }

    this._isOpen = false;
    this._destroyOverlay();

    this._hide(this.uiDialog, this.options.hide, () => {
      this._trigger('close', event);
    });
  },

  open: function () {
    if (this._isOpen) {
      if (this._moveToTop()) {
        //this._focusTabbable();
      }
      return;
    }

    this._isOpen = true;
    this.opener = $(this.document[0].activeElement);

    this._size();
    this._position();
    this._createOverlay();
    this._moveToTop(null, true);

    this._show(this.uiDialog, this.options.show, () => {
      //this._focusTabbable();
      //this._trigger("focus");
    });

    this._trigger('open');
  },
});
