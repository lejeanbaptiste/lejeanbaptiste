import $ from 'jquery';
import 'jquery-ui/ui/widgets/dialog';
import Writer from '../Writer';
import { log } from './../../utilities';

class Header {
  readonly writer: Writer;
  readonly $headerLink: JQuery<HTMLElement>;
  readonly $headerDialog: JQuery<HTMLElement>;

  constructor(writer: Writer, parentEl: JQuery<HTMLElement>) {
    this.writer = writer;

    const headerLink = this.writer.layoutManager.getHeaderButtonsParent();
    if (!headerLink) {
      log.warn('Header link  / buttons parent not found');
      // return;
    }

    //@ts-ignore
    this.$headerLink = $('<div class="editHeader">Edit Header</div>').appendTo(headerLink);

    this.$headerDialog = $(`
    <div class="headerDialog">
      <div>
        <textarea style="font-family: monospace;" spellcheck="false">
        </textarea>
      </div>
    </div>
  `).appendTo(parentEl);

    //@ts-ignore
    this.$headerDialog.dialog({
      title: 'Edit Header',
      modal: true,
      resizable: true,
      height: 380,
      width: 400,
      position: { my: 'center', at: 'center', of: this.writer.layoutManager.getContainer() },
      autoOpen: false,
      buttons: [
        {
          text: 'Ok',
          role: 'ok',
          click: () => {
            const editorString = `<head>${this.$headerDialog.find('textarea').val()}</head>`;
            let xml: XMLDocument;
            try {
              xml = $.parseXML(editorString);
            } catch (error) {
              this.writer.dialogManager.show('message', {
                title: 'Invalid XML',
                msg: 'There was an error parsing the XML.',
                type: 'error',
              });
              return false;
            }

            let headerString = '';

            $(xml)
              .find('head')
              .children()
              .each((index, element) => {
                headerString += this.writer.converter.buildEditorString(element);
              });
            $(
              `[_tag="${this.writer.schemaManager.getHeader()}"]`,
              this.writer.editor.getBody()
            ).html(headerString);

            //@ts-ignore
            this.$headerDialog.dialog('close');
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
          //@ts-ignore
          click: () => this.$headerDialog.dialog('close'),
        },
      ],
    });

    this.$headerLink.on('click', () => {
      this.doOpen();
    });
  }

  private doOpen() {
    let headerString = '';
    const headerEl = $(
      `[_tag="${this.writer.schemaManager.getHeader()}"]`,
      this.writer.editor.getBody()
    );

    headerEl.children().each((index, element) => {
      headerString += this.writer.converter.buildXMLString(element);
    });

    this.$headerDialog.find('textarea').val(headerString);

    //@ts-ignore
    this.$headerDialog.dialog('open');
  }

  show() {
    this.doOpen();
  }

  destroy() {
    //@ts-ignore
    if (this.$headerDialog) this.$headerDialog.dialog('destroy');
  }
}

export default Header;
