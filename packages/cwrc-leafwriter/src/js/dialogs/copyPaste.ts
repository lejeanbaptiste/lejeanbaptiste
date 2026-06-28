import $ from 'jquery';
import i18next from '../../i18n';
import type { LWDialogProps, LWDialogConfigProps } from './types';
import { getSkipCopyPasteHelp, setSkipCopyPasteHelp } from './copyPasteHelpSettings';

type ActionType = 'copy' | 'paste';

const { t } = i18next;

const COPY_PASTE_DOCS_URL =
  'https://cwrc.ca/CWRC-Writer_Documentation/#CWRCWriter_Copy_Splash.html';

const buildMessage = (type: ActionType) => {
  const documentationLink = `<a href="${COPY_PASTE_DOCS_URL}" target="_blank">${t('LW.copyPasteHelp.documentationLink')}</a>`;
  const intro =
    type === 'copy' ? t('LW.copyPasteHelp.copyIntro') : t('LW.copyPasteHelp.pasteIntro');
  const paragraphNote =
    type === 'paste' ? `<br/>${t('LW.copyPasteHelp.pasteParagraphNote')}` : '';

  return `${intro}${paragraphNote}<br/>${t('LW.copyPasteHelp.considerReading')} ${documentationLink}`;
};

class CopyPaste implements LWDialogProps {
  readonly $copyPasteDialog: JQuery<HTMLElement>;
  readonly $skipHelpCheckbox: JQuery<HTMLInputElement>;

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    let firstCopy = true;
    let firstPaste = true;
    let cwrcCopy = false;

    this.$copyPasteDialog = $(`
      <div>
        <div class="content" />
        <label class="skip-copy-paste-help" style="display: block; margin-top: 12px;">
          <input type="checkbox" class="skip-copy-paste-help-input" />
          <span class="skip-copy-paste-help-label" />
        </label>
      </div>
    `).appendTo(parentEl);

    this.$skipHelpCheckbox = this.$copyPasteDialog.find(
      '.skip-copy-paste-help-input',
    ) as JQuery<HTMLInputElement>;

    this.$copyPasteDialog.find('.skip-copy-paste-help-label').text(
      t('LW.settings.warnings.skip_copy_paste_help'),
    );

    this.$skipHelpCheckbox.on('change', () => {
      setSkipCopyPasteHelp(this.$skipHelpCheckbox.prop('checked') === true);
    });

    //@ts-ignore
    this.$copyPasteDialog.dialog({
      title: t('LW.copyPasteHelp.title'),
      modal: true,
      resizable: true,
      closeOnEscape: true,
      height: 300,
      width: 380,
      position: { my: 'center', at: 'center', of: writer.layoutManager.getContainer() },
      autoOpen: false,
      dialogClass: 'splitButtons',
      buttons: [
        {
          text: t('LW.copyPasteHelp.ok'),
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

  show({ modal = false, type }: { modal?: boolean; type: ActionType }) {
    if (getSkipCopyPasteHelp()) return;

    //@ts-ignore
    this.$copyPasteDialog.dialog('option', 'modal', modal);
    this.$copyPasteDialog.find('.content').html(buildMessage(type));
    this.$skipHelpCheckbox.prop('checked', getSkipCopyPasteHelp());
    //@ts-ignore
    this.$copyPasteDialog.dialog('open');
  }

  destroy() {
    //@ts-ignore
    this.$copyPasteDialog.dialog('destroy');
  }
}

export default CopyPaste;
