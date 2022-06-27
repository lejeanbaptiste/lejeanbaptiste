import $ from 'jquery';
class Message {
    writer;
    $parentEl;
    openDialogs;
    constructor({ writer, parentEl }) {
        this.writer = writer;
        this.$parentEl = parentEl;
        this.openDialogs = []; // track the open dialogs
    }
    createMessageDialog({ callback, dialogType, modal = true, height = 300, msg, title, type, width = 300, }) {
        const $message = $(`
      <div>
        <p>
          <span class="ui-state-highlight" style="border: none;">
            <span style="float: left; margin-right: 4px;" class="ui-icon ui-icon-info"></span>
          </span>
          <span class="ui-state-error" style="border: none;">
            <span style="float: left; margin-right: 4px;" class="ui-icon ui-icon-alert"></span>
          </span>
          <span class="message"></span>
        </p>
        <span id="confirmCheckboxParent" style="display: none;">
          <input type="checkbox" id="showConfirmCheckbox" checked/>
          <label for="showConfirmCheckbox">Show this warning next time</label>
        </span>
      </div>
    `).appendTo(this.$parentEl);
        //@ts-ignore
        $message.dialog({
            title,
            modal,
            height,
            width,
            resizable: true,
            closeOnEscape: true,
            position: { my: 'center', at: 'center', of: this.writer.layoutManager.getContainer() },
            autoOpen: false,
            close: () => {
                this.openDialogs.splice(this.openDialogs.indexOf($message), 1);
                //@ts-ignore
                $message.dialog('destroy');
                $message.remove();
                if (dialogType === 'message' && callback) {
                    setTimeout(callback, 0);
                }
            },
        });
        $message.find('p > span[class=message]').html(msg);
        $message.find('p > span[class^=ui-state]').hide();
        if (type === 'info')
            $message.find('p > span[class=ui-state-highlight]').show();
        if (type === 'error')
            $message.find('p > span[class=ui-state-error]').show();
        this.openDialogs.push($message);
        return $message;
    }
    show(config) {
        config.dialogType = 'message';
        const $message = this.createMessageDialog(config);
        //@ts-ignore
        $message.dialog('option', 'buttons', [
            {
                text: 'Ok',
                role: 'ok',
                //@ts-ignore
                click: () => $message.dialog('close'),
            },
        ]);
        //@ts-ignore
        $message.dialog('open');
    }
    confirm(config) {
        const { callback, noText = 'No', showConfirmKey, yesText = 'Yes' } = config;
        if (showConfirmKey) {
            const value = this.writer.dialogManager.getDialogPref(showConfirmKey);
            if (value === false) {
                // user has disabled this confirm so just do the callback
                if (callback)
                    callback(true);
                return;
            }
        }
        config.dialogType = 'confirm';
        const $message = this.createMessageDialog(config);
        if (showConfirmKey)
            $('#confirmCheckboxParent').show();
        //@ts-ignore
        $message.dialog('option', 'buttons', [
            {
                text: yesText,
                role: 'yes',
                click: () => {
                    if (showConfirmKey) {
                        const value = $('#showConfirmCheckbox').prop('checked');
                        this.writer.dialogManager.setDialogPref(showConfirmKey, value);
                    }
                    //@ts-ignore
                    $message.dialog('close');
                    if (callback)
                        setTimeout(() => callback(true), 0); // make sure dialog closes before callback
                },
            },
            {
                text: noText,
                role: 'no',
                click: () => {
                    if (showConfirmKey) {
                        const value = $('#showConfirmCheckbox').prop('checked');
                        this.writer.dialogManager.setDialogPref(showConfirmKey, value);
                    }
                    //@ts-ignore
                    $message.dialog('close');
                    if (callback)
                        setTimeout(() => callback(false), 0); // make sure dialog closes before callback
                },
            },
        ]);
        //@ts-ignore
        $message.dialog('open');
    }
    destroy() {
        for (const dialog of this.openDialogs) {
            //@ts-ignore
            dialog.dialog('destroy');
            dialog.remove();
        }
        this.openDialogs = [];
    }
    getOpenDialogs() {
        return this.openDialogs;
    }
}
export default Message;
//# sourceMappingURL=message.js.map