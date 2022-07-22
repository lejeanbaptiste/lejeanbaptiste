import $ from 'jquery';
import 'jquery-ui/ui/widgets/dialog';
import 'jquery-ui/ui/widgets/tooltip';
import Cookies from 'js-cookie';
import '../lib/jquery/jquery.popup';
// import Triple from './dialogs/triple.js';
import { log } from './../utilities';
import AttributesEditor from './dialogs/attributesEditor/attributesEditor';
import CopyPaste from './dialogs/copyPaste';
import EntitiesDialogs from './dialogs/entities';
import LoadingIndicator from './dialogs/loadingIndicator/loadingIndicator';
import Message from './dialogs/message';
import Popup from './dialogs/popup';
import Translation from './dialogs/translation';
const DIALOG_PREFS_COOKIE_NAME = 'leaf-writer-base-dialog-preferences';
const handleResize = (dialogEl) => {
    if (dialogEl.is(':visible')) {
        if (dialogEl.parent('.ui-dialog').hasClass('popup') == false) {
            const winWidth = $(window).width();
            const winHeight = $(window).height();
            //@ts-ignore
            const dialogWidth = dialogEl.dialog('option', 'width');
            //@ts-ignore
            const dialogHeight = dialogEl.dialog('option', 'height');
            if (!winWidth || !winHeight)
                return;
            if (dialogWidth > winWidth) {
                //@ts-ignore
                dialogEl.dialog('option', 'width', winWidth * 0.8);
            }
            if (dialogHeight > winHeight) {
                //@ts-ignore
                dialogEl.dialog('option', 'height', winHeight * 0.8);
            }
            //@ts-ignore
            dialogEl.dialog('option', 'position', { my: 'center', at: 'center', of: window });
        }
    }
};
let prevAppendTo;
let prevDialogCreate;
let prevTooltipOpen;
let prevPopupCreate;
const setDialogListeners = ($cwrcDialogWrapper) => {
    // store previous values (from parent cwrc writer)
    //@ts-ignore
    prevAppendTo = $.ui.dialog.prototype.options.appendTo;
    //@ts-ignore
    prevDialogCreate = $.ui.dialog.prototype.options.create;
    //@ts-ignore
    prevTooltipOpen = $.ui.tooltip.prototype.options.open;
    //@ts-ignore
    prevPopupCreate = $.custom.popup.prototype.options.create;
    // add event listeners to all of our jquery ui dialogs
    //@ts-ignore
    $.extend($.ui.dialog.prototype.options, {
        appendTo: $cwrcDialogWrapper,
        create: function (event) {
            //@ts-ignore
            $(event.target)
                .on('dialogopen', function (event) {
                handleResize($(event.target));
                $(window).on('resize', $.proxy(handleResize, this, $(event.target)));
            })
                .on('dialogclose', function (event) {
                $(window).off('resize', $.proxy(handleResize, this, $(event.target)));
            });
        },
    });
    // do the same for tooltips
    //@ts-ignore
    $.extend($.ui.tooltip.prototype.options, {
        create: function (event, ui) {
            //@ts-ignore
            const instance = $(this).tooltip('instance');
            instance.liveRegion = instance.liveRegion.appendTo($cwrcDialogWrapper);
        },
    });
    //@ts-ignore
    $.extend($.ui.tooltip.prototype, {
        //@ts-ignore
        _appendTo: (target) => {
            let element = target.closest('.ui-front, dialog');
            // add the tooltip to cwrcDialogWrapper if no ui-front or dialog is found
            if (!element.length)
                element = $cwrcDialogWrapper;
            return element;
        },
    });
    // do the same for popups
    //@ts-ignore
    $.extend($.custom.popup.prototype.options, {
        appendTo: $cwrcDialogWrapper,
        create: function (e) {
            //@ts-ignore
            $(e.target)
                .on('popupopen', function (event) {
                //@ts-ignore
                handleResize($(event.target));
                //@ts-ignore
                $(window).on('resize', $.proxy(handleResize, this, $(event.target)));
            })
                .on('popupclose', function (event) {
                $(window).off('resize', $.proxy(handleResize, this, $(event.target)));
            });
        },
    });
};
const restorePreviousDialogListeners = () => {
    //@ts-ignore
    $.extend($.ui.dialog.prototype.options, {
        appendTo: prevAppendTo,
        create: prevDialogCreate,
    });
    //@ts-ignore
    $.extend($.ui.tooltip.prototype.options, {
        open: prevTooltipOpen,
    });
    //@ts-ignore
    $.extend($.custom.popup.prototype.options, {
        appendTo: prevAppendTo,
        create: prevPopupCreate,
    });
};
const defaultDialogs = new Map([
    ['attributesEditor', { dialogClass: AttributesEditor }],
    ['copyPaste', { dialogClass: CopyPaste }],
    ['loadingindicator', { dialogClass: LoadingIndicator }],
    ['message', { dialogClass: Message }],
    ['popup', { dialogClass: Popup }],
    ['translation', { dialogClass: Translation }],
]);
/**
 * @class DialogManager
 * @param {Writer} writer
 */
class DialogManager {
    writer;
    $cwrcDialogWrapper;
    dialogs = new Map();
    schemaDialogs = new Map();
    // schema dialogs name, class map
    // readonly schemaDialogs: { [x: string]: SchemaDialog } = {};
    constructor(writer) {
        this.writer = writer;
        const container = this.writer.layoutManager.getContainer();
        if (!container) {
            throw Error('HTML container is missiong');
        }
        this.$cwrcDialogWrapper = $('<div class="cwrc cwrcDialogWrapper"></div>').appendTo(container);
        setDialogListeners(this.$cwrcDialogWrapper);
        defaultDialogs.forEach((dialogConfig, name) => this.addDialog(name, dialogConfig));
        const loadSchemaDialogs = () => {
            const schemaMappingsId = this.writer.schemaManager.getCurrentSchema()?.mapping;
            if (!schemaMappingsId) {
                log.warn('schemaMappingsId is undefined');
                return;
            }
            Object.entries(EntitiesDialogs).forEach(([dialogName, dialog]) => {
                const schemaDialog = new dialog({ writer: this.writer, parentEl: this.$cwrcDialogWrapper });
                this.schemaDialogs.set(dialogName, schemaDialog);
            });
        };
        this.writer.event('schemaLoaded').subscribe(loadSchemaDialogs);
    }
    addDialog(name, { dialogClass, type }) {
        const dialog = new dialogClass({
            writer: this.writer,
            parentEl: this.$cwrcDialogWrapper,
            type,
        });
        this.dialogs.set(name, dialog);
        return dialog;
    }
    getDialog(name) {
        return this.dialogs.get(name);
    }
    getDialogWrapper() {
        return this.$cwrcDialogWrapper;
    }
    /**
     * Show the dialog specified by type.
     * @param {String} type The dialog type
     * @param {Object} [config] A configuration object to pass to the dialog
     */
    show(type, config) {
        const dialog = this.dialogs.get(type) ?? this.schemaDialogs.get(type);
        if (!dialog) {
            log.warn(`Dialog ${type} not found!`);
            return;
        }
        if (!config &&
            (type === 'person' ||
                type === 'place' ||
                type === 'organization' ||
                type === 'title' ||
                type === 'rs' ||
                type === 'citation')) {
            this.writer.overmindActions.ui.openEntityLookupsDialog({
                type,
                onClose: (response) => {
                    if (!response)
                        return;
                    const type = response.type;
                    this.show(type, response);
                },
            });
            return;
        }
        dialog.show(config);
    }
    confirm(config) {
        const messageDialog = this.dialogs.get('message');
        if (messageDialog?.confirm)
            messageDialog.confirm(config);
    }
    destroy() {
        this.schemaDialogs.forEach((dialog) => dialog.destroy());
        this.dialogs.forEach((dialog) => dialog.destroy());
        restorePreviousDialogListeners();
    }
    getDialogPref(name) {
        const prefsCookies = Cookies.get(DIALOG_PREFS_COOKIE_NAME);
        if (!prefsCookies)
            return;
        let prefs = JSON.parse(prefsCookies);
        if (prefs[name] === undefined)
            return;
        return prefs[name];
    }
    setDialogPref(name, value) {
        const prefsCookies = Cookies.get(DIALOG_PREFS_COOKIE_NAME);
        let prefs = prefsCookies ? JSON.parse(prefsCookies) : {};
        prefs[name] = value;
        Cookies.set(DIALOG_PREFS_COOKIE_NAME, JSON.stringify(prefs), { expires: 7, path: '' });
    }
    clearDialogPrefs() {
        Cookies.remove(DIALOG_PREFS_COOKIE_NAME, { path: '' });
    }
}
export default DialogManager;
//# sourceMappingURL=dialogManager.js.map