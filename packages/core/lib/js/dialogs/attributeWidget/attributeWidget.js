import 'css-tooltip';
import $ from 'jquery';
// import Mapper from '../../schema/mapper';
import { RESERVED_ATTRIBUTES } from '../../schema/mapper';
import { capitalizeFirstLetter } from '../../utilities';
import { log } from './../../../utilities';
class AttributeWidget {
    static ADD = 0;
    static EDIT = 1;
    writer;
    $el; // the el to add the attribute widget to
    $parent; // the parent form (optional)
    showSchemaHelp = false;
    mode = 0; //add
    isDirty = false;
    constructor({ writer, $el, $parent, showSchemaHelp = false }) {
        this.writer = writer;
        this.$el = $el;
        this.$parent = $parent;
        this.showSchemaHelp = showSchemaHelp;
        this.$el.addClass('attributeWidget');
        this.$el.append(`<div class="attsContainer"/>`);
        if (this.$parent) {
            // add listeners for other form elements
            $('[data-mapping]', this.$parent).each($.proxy(function (index, element) {
                const formEl = $(element);
                const type = formEl.data('type');
                const mapping = formEl.data('mapping');
                // check the mapping to make sure it's an attribute
                // TODO if the data-type is hidden then the attribute should not be modifiable in this widget
                if (mapping.indexOf('custom.') === -1 && mapping.indexOf('prop.') === -1) {
                    let changeEl;
                    if (type === 'radio') {
                        changeEl = $('input', formEl);
                    }
                    else if (type === 'textbox' || type === 'select') {
                        changeEl = formEl;
                    }
                    if (changeEl) {
                        changeEl.on('change', $.proxy(function (mapping, event) {
                            const dataObj = {};
                            dataObj[mapping] = $(event.target).val();
                            this.setData(dataObj);
                        }, this, mapping));
                    }
                }
            }, this));
        }
    }
    buildWidget(atts, initialVals = {}, tag) {
        //reset
        $('.attributeSelector ul', this.$parent).empty();
        $('.attsContainer, .schemaHelp', this.$el).empty();
        this.isDirty = false;
        if (this.showSchemaHelp && tag) {
            const helpText = this.writer.schemaManager.getDocumentationForTag(tag);
            if (helpText !== '') {
                $('.annotationDialog').find('.schemaHelp').html(`${helpText}`);
            }
        }
        //sort attributes
        atts = this.sortAttributes(atts);
        // const disallowedAttributes = Mapper.reservedAttributes;
        // build atts
        let attsString = '';
        let attributeSelector = '';
        let isRequired = false;
        for (const att of atts) {
            //skip disallowedAttributes
            // if (disallowedAttributes[att.name]) continue;
            if (RESERVED_ATTRIBUTES.has(att.name))
                continue;
            let currAttString = '';
            isRequired = att.required;
            // Attribute name
            let displayName = att.name;
            if (att.fullName !== '') {
                displayName += `<span class="fullname"> ${att.fullName}</span>`;
            }
            //required attribute
            const requiredClass = isRequired ? ' required' : '';
            //create selector component
            attributeSelector += this.createAttributeSelector(att.name, displayName, requiredClass, initialVals[att.name]);
            //field component
            att.defaultValue = initialVals[att.name] ? initialVals[att.name] : '';
            const display = initialVals[att.name] ? 'flex' : 'none';
            currAttString = this.createAttributeField({
                attributeName: att.name,
                choices: att.choices,
                displayCSS: display,
                displayName,
                defaultValue: att.defaultValue,
                documentation: att.documentation,
                isRequired,
            });
            attsString += currAttString;
        }
        //Add html content
        $('.attributeSelector ul', this.$parent).html(attributeSelector);
        $('.attsContainer', this.$el).html(attsString);
        //Handle selector events
        $('.attributeSelector li', this.$parent).on('click', (event) => {
            const currentTarget = event.currentTarget;
            const name = $(currentTarget).data('name').replace(/:/g, '\\:');
            const div = $(`[data-name="form_${name}"]`, this.$el);
            $(currentTarget).toggleClass('selected');
            $(currentTarget).hasClass('selected') ? div.show() : div.hide();
        });
        //Handle field inputs events
        $('input, select, option', this.$el).on('change', () => {
            this.isDirty = true;
        });
        $('select, option', this.$el).on('click', () => {
            this.isDirty = true;
        });
    }
    sortAttributes(atts) {
        const sortedAtts = atts.sort((a, b) => {
            if (a.name > b.name) {
                return 1;
            }
            else if (a.name < b.name) {
                return -1;
            }
            return 0;
        });
        return sortedAtts;
    }
    addHelpButton(documentation, cssOnly = true) {
        // if (!documentation) return null;
        // if (cssOnly) {
        //   return `<span title="${documentation}"><i class="fas fa-question-circle"></i></span>`;
        // }
        // return `
        //   <span class="tooltip-multiline tooltip-bottom-left" data-tooltip="${documentation}">
        //     <i class="fas fa-question-circle"></i>
        //   </span>
        // `;
    }
    addSelectInput(attributeName, choices, defaultValue = '') {
        return `<select name="${attributeName}">
      ${choices
            .map((attVal) => {
            let selected = defaultValue == attVal ? ' selected="selected"' : '';
            return `<option value="${attVal}"${selected}>${attVal}</option>`;
        })
            .join('\n')}
    </select>`;
    }
    addTextInput(attributeName, defaultValue = '') {
        return `<input type="text" name="${attributeName}" value="${defaultValue}"/>`;
    }
    createAttributeField({ attributeName, choices, displayCSS = 'flex', displayName, defaultValue, documentation, isRequired = false, }) {
        // TODO add list support
        // if ($('list', attDef).length > 0) {
        //   currAttString += '<input type="text" name="'+att.name+'" value="'+att.defaultValue+'"/>';
        //input
        const inputHTML = choices && choices.length > 0
            ? this.addSelectInput(attributeName, choices, defaultValue)
            : this.addTextInput(attributeName, defaultValue);
        const documentText = documentation
            ? Array.isArray(documentation)
                ? documentation
                    .map((p) => {
                    return p['#text']
                        ? `<span style="display: inline-block; margin-bottom: 4px;">
                    ${capitalizeFirstLetter(p['#text'])}
                  </span>`
                        : '';
                })
                    .join(' ')
                : capitalizeFirstLetter(documentation)
            : undefined;
        let htmlPart = `
      <div data-name="form_${attributeName}" class="attribute" style="display:${displayCSS};">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; flex-direction: row; align-items: baseline; width: 100%;">
            <label class="fieldLabel">
              ${displayName}
            </label>
            ${isRequired ? '<span class="required">*</span>' : ''}
          </div>
          ${inputHTML}
          ${documentText
            ? `<span style="font-size: 0.7rem; color: #666;">${documentText}</span>`
            : ''}
        </div>
      </div>
    `;
        return htmlPart;
    }
    createAttributeSelector(attributeName, displayName, requiredClass, isInitial = false) {
        const selected = isInitial ? 'selected' : '';
        return `
      <li data-name="${attributeName}" class="${selected}${requiredClass}">${displayName}</li>
    `;
    }
    reset() {
        $('.attributeSelector li', this.$parent).each((index, element) => {
            $(element).removeClass('selected');
            const name = $(element).data('name').replace(/:/g, '\\:');
            const div = $(`[data-name="form_${name}"]`, this.$el);
            div.hide();
        });
        $('.attsContainer input, .attsContainer select', this.$el).val('');
    }
    /**
     * Sets the attribute data for the widget.
     * @param {Object} data A map of attribute name / value pairs
     * @returns {Boolean} True if data was set
     */
    setData(data) {
        let wasDataSet = false;
        for (const key in data) {
            const val = data[key];
            wasDataSet = this.setAttribute(key, val) || wasDataSet;
        }
        return wasDataSet;
    }
    /**
     * Set a single attribute value for the widget.
     * If the value is undefined or null then it is removed.
     * @param {String} name Attribute name
     * @param {String} value Attribute value
     * @returns {Boolean} True if data was set
     */
    setAttribute(name, value) {
        const li = $(`.attributeSelector li[data-name="${name}"]`, this.$parent);
        if (li.length !== 1) {
            log.warn(`attributeWidget: no attribute for ${name}`);
            return false;
        }
        if (value) {
            li.addClass('selected');
            const div = $(`[data-name="form_${name}"]`, this.$parent);
            $('input, select', div).val(value);
            div.show();
        }
        else {
            li.removeClass('selected');
            const div = $(`[data-name="form_${name}"]`, this.$parent);
            $('input, select', div).val('');
            div.hide();
        }
        return true;
    }
    /**
     * Collects the data from the attribute widget and performs validation.
     * @returns {Object|undefined} Returns undefined if invalid
     */
    getData() {
        const attributes = {};
        $('.attributeSelector li.selected', this.$parent).each((index, el) => {
            const name = $(el).data('name');
            $(`.attsContainer > div[data-name="form_${name}"] input[type!="hidden"], select`, this.$el).each((index, element) => {
                const val = $(element).val();
                const attrName = $(element).attr('name');
                // ignore blank values
                if (attrName && val && val !== '')
                    attributes[attrName] = val;
            });
        });
        // validation
        const invalid = [];
        $('.attsContainer span.required', this.$el)
            .parent()
            // .children('input[type!="hidden"], select')
            .find('input[type!="hidden"], select')
            .each((index, element) => {
            const attrName = $(element).attr('name');
            if (!attrName)
                return;
            const entry = attributes[attrName];
            if (!entry || entry == '')
                invalid.push(attrName);
        });
        //highlight invalid
        if (invalid.length > 0) {
            for (const name of invalid) {
                $(`.attsContainer *[name="${name}"]`, this.$el)
                    .css({ borderColor: 'red' })
                    .on('keyup', (event) => {
                    $(this).css({ borderColor: '#ccc' });
                });
            }
            return attributes; // still return values even if invalid (for now)
        }
        return attributes;
    }
    destroy() { }
}
export default AttributeWidget;
//# sourceMappingURL=attributeWidget.js.map