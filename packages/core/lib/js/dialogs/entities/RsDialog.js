import $ from 'jquery';
import 'jquery-ui/ui/widgets/selectmenu';
import DialogForm from '../dialogForm/dialogForm';
import { getSourceNameFromUrl } from './util';
const OTHER_OPTION = '$$$$OTHER$$$$';
const typeRoot = 'http://sparql.cwrc.ca/ontology/cwrc#';
const types = [
    'Award',
    'BirthPosition',
    'Certainty',
    'Credential',
    'EducationalAward',
    'Ethnicity',
    'Gender',
    'GeographicHeritage',
    'NationalHeritage',
    'NationalIdentity',
    'NaturalPerson',
    'Occupation',
    'PoliticalAffiliation',
    'Precision',
    'RaceColour',
    'Religion',
    'ReproductiveHistory',
    'Role',
    'Sexuality',
    'SocialClass',
    'TextLabels',
];
const certaintyOptions = ['high', 'medium', 'low', 'Unknown'];
class RsDialog {
    writer;
    dialog;
    $el;
    entry;
    selectedText;
    type = 'rs';
    constructor({ writer, parentEl }) {
        this.writer = writer;
        const id = writer.getUniqueId('rsForm_');
        const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.selectedTextField(id)}
        ${this.tagAsField(id)}
        ${this.certaintyField(id)}
        ${this.rsTypeField(id)}
        ${this.otherTypeField()}
      </div>
    `;
        this.$el = $(`
      <div class="annotationDialog">
        <div class="content">
          <div class="main">
            ${entityAttributesSection}
          
            <hr style="width: 100%; border: none; border-bottom: 1px solid #ccc;">
          
            <div
              id="${id}_attParent"
              class="attributes"
              data-type="attributes"
              data-mapping="attributes"
            />
          </div>

          <div class="attributeSelector">
            <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 4px;">Markups</h3>
            <ul></ul>
          </div>
        </div>
      </div>
    `).appendTo(parentEl);
        //@ts-ignore
        const $relinkButton = $(`#${id}_tagAs .relink-bt`, this.$el).button();
        $relinkButton.on('click', () => {
            parentEl.css('display', 'none');
            this.writer.overmindActions.ui.openEntityLookupsDialog({
                entry: this.entry,
                type: this.type,
                onClose: (response) => {
                    parentEl.css('display', 'block');
                    if (!response) {
                        this.updateTagAs();
                        return;
                    }
                    const uri = response.uri ?? '';
                    const lemma = response.name ?? '';
                    this.updateLink(lemma, uri);
                },
            });
        });
        this.dialog = new DialogForm({
            writer,
            $el: this.$el,
            type: 'rs',
            title: 'Tag Referencing String',
        });
        const _this = this;
        // select setup
        this.$el
            .find('select[name=type]')
            //@ts-ignore
            .selectmenu('menuWidget')
            .addClass('overflow')
            .height('300px')
            .css('box-shadow', '0px 1px 8px rgb(0 0 0 / 35%)');
        //select event
        this.$el
            .find('select[name=type]')
            //@ts-ignore
            .selectmenu('refresh')
            .on('selectmenuselect', function (event, ui) {
            if (ui.item.value === OTHER_OPTION) {
                _this.$el.find('input[name=otherType]').parent().show();
                return;
            }
            // set the other input value to that of the selection and then hide
            _this.$el.find('input[name=otherType]').val(ui.item.value).parent().hide();
            // manually fire change event in order to update attribute widget
            //@ts-ignore
            $(this).trigger('change', { target: this });
        });
        //dialog evvents
        this.dialog.$el.on('beforeShow', (event, config) => {
            // handle type selection
            const entry = config.entry;
            let typeValue = '';
            let otherType = false;
            if (entry !== undefined && entry.getAttribute('type') !== undefined) {
                typeValue = entry.getAttribute('type');
                otherType = types.indexOf(typeValue) === -1;
            }
            if (otherType) {
                //@ts-ignore
                this.$el.find('select[name=type]').val(OTHER_OPTION).selectmenu('refresh');
                this.$el.find('input[name=otherType]').val(typeValue).parent().show();
            }
            else {
                this.$el.find('select[name=type]').val(typeValue);
                this.$el.find('input[name=otherType]').val(typeValue).parent().hide();
            }
        });
        this.dialog.$el.on('beforeSave', (event, config) => {
            //@ts-ignore
            if (this.dialog.currentData.attributes.type === '') {
                //@ts-ignore
                delete this.dialog.currentData.attributes.type;
            }
        });
    }
    updateLink(lemma, uri) {
        if (this.entry) {
            this.writer.entitiesManager.setURIForEntity(this.entry.getId(), uri);
            this.writer.entitiesManager.setLemmaForEntity(this.entry.getId(), lemma);
            this.entry = this.writer.entitiesManager.getEntity(this.entry.getId());
        }
        this.updateTagAs(lemma, uri);
        this.dialog.attributesWidget?.setAttribute('key', lemma);
        this.dialog.attributesWidget?.setAttribute('ref', uri);
    }
    updateTagAs(lemma, uri) {
        if (!lemma || !uri) {
            $('.tagAsSource').hide();
            $('.tagAsSourceLink').text('');
            $('.tagAsSourceLink').attr('href', '');
            return;
        }
        $('.tagAs').text(lemma);
        const source = getSourceNameFromUrl(uri);
        $('.tagAsSource').show();
        $('.tagAsSourceLink').text(source);
        $('.tagAsSourceLink').attr('href', uri);
    }
    selectedTextField(id) {
        const fieldTitle = 'Selected Text';
        return `
      <div id="${id}_selectedText" class="attribute">
        <p class="fieldLabel">${fieldTitle}</p>
        <p class="selectedText">${this.selectedText}</p>
      </div>
    `;
    }
    updateTextField(value) {
        const fontSize = value.length > 30 ? 1 : 1.2;
        $('.selectedText').css('font-size', `${fontSize}em`);
        $('.selectedText').text(value);
    }
    tagAsField(id) {
        const fieldTitle = 'Tag as';
        return `
      <div id="${id}_tagAs" class="attribute">
        <div style="display: flex; align-items: center; gap: 8px;">
        <p class="fieldLabel">${fieldTitle}</p>
        
        <div class="relink-bt" style="cursor: pointer; padding: 4px;">
          <i class="fas fa-edit" />
        </div>
      </div>

        
        <div style="display: flex; flex-direction: column;" >
          <span class="tagAs" data-type="label" data-mapping="prop.lemma"></span>
          <span class="tagAsSource" style="color: #999; display: none;">source: 
          <a class="tagAsSourceLink" href="" target="_blank" rel="noopener noreferrer nofollow"></a>
          </span>
        </div>
      </div>
    `;
    }
    certaintyField(id) {
        const fieldTitle = 'Level of certainty';
        const html = `
      <div
        id="${id}_certainty"
        class="attribute"
        data-transform="controlgroup"
        data-type="radio"
        data-mapping="cert"
      >
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        ${certaintyOptions
            .map((certainty) => {
            return `
            <input
              type="radio"
              id="${id}_${certainty}"
              name="${id}_id_certainty"
              value="${certainty}"
            />
            <label for="${id}_${certainty}" style="text-transform: capitalize">
              ${certainty}
            </label>
          `;
        })
            .join('\n')}
      </div>
    `;
        return html;
    }
    rsTypeField(id) {
        const fieldTitle = 'Type (optional)';
        const html = `
      <div class="attribute type">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        <select name="type" data-mapping="type" data-type="select" data-transform="selectmenu">
          <option value="">(none)</option>
          <option value="${OTHER_OPTION}">Other (specify)</option>
          ${types.map((type) => `<option value="${typeRoot + type}">${type}</option>`).join('\n')}
        </select>
      </div>
    `;
        return html;
    }
    otherTypeField() {
        const fieldTitle = 'Other type';
        return `
      <div style="margin-top: 5px">
        <label>${fieldTitle}</label>
        <input name="otherType" type="text" data-mapping="type" data-type="textbox" />
      </div>
    `;
    }
    show(config) {
        this.entry = config.entry ? config.entry : undefined;
        this.selectedText = config.entry ? config.entry.content : config.query;
        this.updateTextField(this.selectedText ?? '');
        if (config.name && config.uri)
            this.updateTagAs(config.name, config.uri);
        if (!config.uri)
            this.updateTagAs();
        this.dialog.show(config);
    }
    destroy() {
        //@ts-ignore
        this.$el.find('select[name=type]').selectmenu('destroy');
        this.dialog.destroy();
    }
}
export default RsDialog;
//# sourceMappingURL=RsDialog.js.map