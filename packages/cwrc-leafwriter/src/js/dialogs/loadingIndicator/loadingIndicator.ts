import $ from 'jquery';
import 'jquery-ui/ui/widgets/dialog';
import 'jquery-ui/ui/widgets/progressbar';
import type { LWDialogProps, LWDialogConfigProps } from '../types';

const isDesktopApp = () =>
  typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI;

class LoadingIndicator implements LWDialogProps {
  readonly $loadingIndicator: JQuery<HTMLElement>;
  readonly $progressBar: JQuery<HTMLElement>;
  readonly $progressLabel: JQuery<HTMLElement>;
  /** Desktop covers document open with DocumentLoadingCover; only allow save feedback. */
  private allowDesktopShow = false;

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    this.$loadingIndicator = $(
      `<div class="loadingIndicatorDialog">
        <div class="progressBar">
          <div class="progressLabel" />
        </div>
      </div>`,
    ).appendTo(parentEl);

    this.$loadingIndicator.dialog({
      title: writer.appDisplayName,
      modal: true,
      resizable: false,
      closeOnEscape: false,
      width: 260,
      height: 'auto',
      position: { my: 'center', at: 'center', of: writer.layoutManager.getContainer() },
      buttons: {},
      autoOpen: false,
      //@ts-expect-error
      open: (event: JQuery.Event, ui) => {
        $('.ui-dialog-titlebar-close', ui.dialog).hide();
        $(ui.dialog)
          .find('.ui-dialog-content')
          .css({ padding: '8px 12px 10px', overflow: 'hidden' });
      },
    });

    this.$progressBar = this.$loadingIndicator.find('.progressBar');
    //@ts-expect-error
    this.$progressBar.progressbar({ value: 0 });
    this.$progressLabel = this.$loadingIndicator.find('.progressLabel');

    writer.event('loadingDocument').subscribe(() => {
      // Desktop uses DocumentLoadingCover over the editor pane instead.
      if (isDesktopApp()) return;
      writer.dialogManager.show('loadingindicator');
      this.$progressLabel.text('Loading Document');
      //@ts-expect-error
      this.$progressBar.progressbar('value', false);
    });

    writer.event('loadingSchema').subscribe(() => {
      if (isDesktopApp()) return;
      writer.dialogManager.show('loadingindicator');
      this.$progressLabel.text('Loading Schema');
      //@ts-expect-error
      this.$progressBar.progressbar('value', false);
    });

    writer.event('documentLoaded').subscribe(() => {
      //@ts-expect-error
      this.$progressBar.progressbar('value', 100);
      this.$loadingIndicator.dialog('close');
    });

    writer.event('schemaLoaded').subscribe(() => {
      this.$progressLabel.text('Schema Loaded');
      this.$loadingIndicator.dialog('close');
    });

    writer.event('savingDocument').subscribe(() => {
      this.allowDesktopShow = true;
      writer.dialogManager.show('loadingindicator');
      this.$progressLabel.text('Saving Document');
      //@ts-expect-error
      this.$progressBar.progressbar('value', 5);
    });

    writer.event('documentSaved').subscribe((success: boolean) => {
      //@ts-expect-error
      this.$progressBar.progressbar('value', 100);

      if (success === true) {
        this.$loadingIndicator.dialog('close');
        this.allowDesktopShow = false;
        return;
      }

      this.$progressLabel.text('Error Saving Document');
      this.$loadingIndicator.dialog('option', 'buttons', {
        Ok: () => {
          this.allowDesktopShow = false;
          this.$loadingIndicator.dialog('close');
        },
      });
    });
  }

  setText(text: string) {
    this.$progressLabel.text(text);
  }

  setValue(percent: number | boolean) {
    //@ts-expect-error
    this.$progressBar.progressbar('value', percent);
  }

  show() {
    if (isDesktopApp() && !this.allowDesktopShow) return;
    this.$loadingIndicator.dialog('open');
  }

  hide() {
    this.$loadingIndicator.dialog('close');
    this.allowDesktopShow = false;
  }

  destroy() {
    //@ts-expect-error
    this.$progressBar.progressbar('destroy');
    this.$loadingIndicator.dialog('destroy');
  }
}

export default LoadingIndicator;
