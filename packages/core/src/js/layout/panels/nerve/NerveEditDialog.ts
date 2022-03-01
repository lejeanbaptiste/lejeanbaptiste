import $ from 'jquery';
import DialogForm from '../../../dialogs/dialogForm/dialogForm';
// import { doLookup } from './util';

function NerveEditDialog(writer: any, parentEl: HTMLElement) {
  let forceSave = false; // needed for confirmation dialog in beforeSave

  const $el = $(`
    <div class="annotationDialog">
      <div>
        <select data-transform="selectmenu" data-type="select" data-mapping="prop.type">
          <option value="person">Person</option>
          <option value="place">Place</option>
          <option value="org">Organization</option>
          <option value="title">Title</option>
        </select>
      </div>
      <div>
        <label>Standard name:</label>
        <input type="text" data-type="textbox" data-mapping="prop.lemma" />
      </div>
      <div>
        <label>URI:</label>
        <input type="text" data-type="textbox" data-mapping="prop.uri" style="margin-right: 5px;" />
        <button type="button" title="Entity lookup" data-action="lookup">
          <i class="fas fa-search icon"></i>
        </button>
      </div>
    </div>
  `).appendTo(parentEl);

  const dialog = new DialogForm({
    writer,
    $el,
    type: 'person',
    title: 'Edit Entity',
    width: 350,
    height: 300,
  });

  dialog.$el.find('button[data-action=lookup]').on('click', () => {
    const type = dialog.$el.find('select').val();
    //@ts-ignore
    const entity = dialog.showConfig.entry;
    const query = entity.content.trim().replace(/\s+/g, ' ');
    // doLookup(writer, query, type, ({ name, uri }: { name: string; uri: string }) => {
    //   dialog.$el.find('input[data-mapping="prop.lemma"]').val(name);
    //   dialog.$el.find('input[data-mapping="prop.uri"]').val(uri);
    // });
  });

  dialog.$el.on('beforeShow', () => (forceSave = false));

  dialog.$el.on('beforeSave', (event: any, dialog: any) => {
    if (forceSave) {
      dialog.isValid = true;
    } else {
      const uri: string = dialog.$el.find('input[data-mapping="prop.uri"]').val();
      const isValidURLRegex = new RegExp('^https?://');

      if (uri !== '' && uri.search(isValidURLRegex) !== 0) {
        dialog.isValid = false;
        writer.dialogManager.confirm({
          title: 'Warning',
          msg: `
            <p>The URI you have entered does not look valid.</p>
            <p>Are you sure you want to use it?</p>
          `,
          showConfirmKey: 'confirm-nerve-uri',
          type: 'info',
          callback: (doIt: boolean) => {
            if (!doIt) return;

            // need setTimeout in case confirm dialog is skipped
            setTimeout(() => {
              forceSave = true;
              dialog.save();
            });
          },
        });
      } else {
        dialog.isValid = true;
      }
    }

    if (dialog.isValid) {
      const sm = writer.schemaManager;

      const type = dialog.currentData.properties.type;
      const tag = sm.mapper.getParentTag(type);
      dialog.currentData.properties.tag = tag;

      const oldType = writer.entitiesManager.getEntity(dialog.currentId).getType();
      if (type !== oldType) {
        const requiredAttributes = sm.mapper.getRequiredAttributes(oldType);
        for (const attName in requiredAttributes) {
          delete dialog.currentData.attributes[attName];
        }
      }

      const lemmaMapping = sm.mapper.getAttributeForProperty(type, 'lemma');
      if (lemmaMapping) {
        dialog.currentData.attributes[lemmaMapping] = dialog.$el
          .find('input[data-mapping="prop.lemma"]')
          .val();
      }
      const uriMapping = sm.mapper.getAttributeForProperty(type, 'uri');
      if (uriMapping) {
        dialog.currentData.attributes[uriMapping] = dialog.$el
          .find('input[data-mapping="prop.uri"]')
          .val();
      }

      dialog.currentData.customValues.edited = 'true';
    }
  });

  return dialog;
}

export default NerveEditDialog;
