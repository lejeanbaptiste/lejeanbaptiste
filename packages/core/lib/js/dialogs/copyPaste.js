import $ from 'jquery';
class CopyPaste {
    $copyPasteDialog;
    copyMsg;
    pasteMsg;
    constructor({ writer, parentEl }) {
        let firstCopy = true;
        let firstPaste = true;
        let cwrcCopy = false;
        this.copyMsg = `
      It looks like you are trying to copy content.<br/>
      Consider having a look at the
        <a
          href="https://cwrc.ca/CWRC-Writer_Documentation/#CWRCWriter_Copy_Splash.html"
          target="_blank"
        >
          Copy & Paste Documentation
        </a>
    `;
        this.pasteMsg = `
      It looks like you are trying to paste from outside CWRC-Writer.
      Be aware that <b>all tags will be removed</b> and only plain text will remain.<br/>
      Consider having a look at the
      <a
        href="https://cwrc.ca/CWRC-Writer_Documentation/#CWRCWriter_Copy_Splash.html"
        target="_blank"
      >
        Copy & Paste Documentation
      </a>
    `;
        this.$copyPasteDialog = $(`
      <div>
        <div class="content" />
      </div>
    `).appendTo(parentEl);
        //@ts-ignore
        this.$copyPasteDialog.dialog({
            title: 'Copy & Paste Help',
            modal: true,
            resizable: true,
            closeOnEscape: true,
            height: 250,
            width: 350,
            position: { my: 'center', at: 'center', of: writer.layoutManager.getContainer() },
            autoOpen: false,
            dialogClass: 'splitButtons',
            buttons: [
                {
                    text: 'Ok',
                    //@ts-ignore
                    click: () => this.$copyPasteDialog.dialog('close'),
                },
            ],
        });
        writer.event('contentCopied').subscribe(() => {
            cwrcCopy = true;
            if (firstCopy) {
                firstCopy = false;
                this.show({ type: 'copy' });
            }
        });
        writer.event('contentPasted').subscribe(() => {
            if (firstPaste && !cwrcCopy) {
                firstPaste = false;
                this.show({ type: 'paste' });
            }
            cwrcCopy = false;
        });
    }
    show({ modal = false, type }) {
        const msg = type === 'copy' ? this.copyMsg : this.pasteMsg;
        //@ts-ignore
        this.$copyPasteDialog.dialog('option', 'modal', modal);
        this.$copyPasteDialog.find('.content').html(msg);
        //@ts-ignore
        this.$copyPasteDialog.dialog('open');
    }
    destroy() {
        //@ts-ignore
        this.$copyPasteDialog.dialog('destroy');
    }
}
export default CopyPaste;
//# sourceMappingURL=copyPaste.js.map