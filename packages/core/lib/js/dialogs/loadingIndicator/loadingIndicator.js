import $ from 'jquery';
import 'jquery-ui/ui/widgets/dialog';
import 'jquery-ui/ui/widgets/progressbar';
class LoadingIndicator {
    $loadingIndicator;
    $progressBar;
    $progressLabel;
    constructor({ writer, parentEl }) {
        this.$loadingIndicator = $(`<div class="loadingIndicatorDialog">
        <div class="progressBar">
          <div class="progressLabel" />
        </div>
      </div>`).appendTo(parentEl);
        //@ts-ignore
        this.$loadingIndicator.dialog({
            title: 'CWRC-Writer',
            modal: true,
            resizable: false,
            closeOnEscape: false,
            height: 160,
            width: 300,
            position: { my: 'center', at: 'center', of: writer.layoutManager.getContainer() },
            buttons: {},
            autoOpen: false,
            //@ts-ignore
            open: (event, ui) => $('.ui-dialog-titlebar-close', ui.dialog).hide(),
        });
        this.$progressBar = this.$loadingIndicator.find('.progressBar');
        //@ts-ignore
        this.$progressBar.progressbar({ value: 0 });
        this.$progressLabel = this.$loadingIndicator.find('.progressLabel');
        writer.event('loadingDocument').subscribe(() => {
            writer.dialogManager.show('loadingindicator');
            this.$progressLabel.text('Loading Document');
            //@ts-ignore
            this.$progressBar.progressbar('value', false);
        });
        writer.event('loadingSchema').subscribe(() => {
            writer.dialogManager.show('loadingindicator');
            this.$progressLabel.text('Loading Schema');
            //@ts-ignore
            this.$progressBar.progressbar('value', false);
        });
        writer.event('documentLoaded').subscribe(() => {
            //@ts-ignore
            this.$progressBar.progressbar('value', 100);
            //@ts-ignore
            this.$loadingIndicator.dialog('close');
        });
        writer.event('schemaLoaded').subscribe(() => {
            this.$progressLabel.text('Schema Loaded');
            //@ts-ignore
            this.$loadingIndicator.dialog('close');
        });
        writer.event('savingDocument').subscribe(() => {
            writer.dialogManager.show('loadingindicator');
            this.$progressLabel.text('Saving Document');
            //@ts-ignore
            this.$progressBar.progressbar('value', 5);
        });
        writer.event('documentSaved').subscribe((success) => {
            //@ts-ignore
            this.$progressBar.progressbar('value', 100);
            if (success === true) {
                //@ts-ignore
                this.$loadingIndicator.dialog('close');
                return;
                // FIXME need to close immediately because of problems if there's another modal showing
                // this.$progressLabel.text('Document Loaded');
                // this.$loadingIndicator.fadeOut(1000, () => this.$loadingIndicator.dialog('close'));
            }
            this.$progressLabel.text('Error Saving Document');
            //@ts-ignore
            this.$loadingIndicator.dialog('option', 'buttons', {
                //@ts-ignore
                Ok: () => this.$loadingIndicator.dialog('close'),
            });
        });
    }
    setText(text) {
        this.$progressLabel.text(text);
    }
    setValue(percent) {
        //@ts-ignore
        this.$progressBar.progressbar('value', percent);
    }
    show() {
        //@ts-ignore
        this.$loadingIndicator.dialog('open');
    }
    hide() {
        //@ts-ignore
        this.$loadingIndicator.dialog('close');
    }
    destroy() {
        //@ts-ignore
        this.$progressBar.progressbar('destroy');
        //@ts-ignore
        this.$loadingIndicator.dialog('destroy');
    }
}
export default LoadingIndicator;
//# sourceMappingURL=loadingIndicator.js.map