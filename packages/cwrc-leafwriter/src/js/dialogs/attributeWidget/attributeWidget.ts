import 'css-tooltip';
import $ from 'jquery';
import { RESERVED_ATTRIBUTES } from '../../schema/mapper';
import { capitalizeFirstLetter } from '../../utilities';
import Writer from '../../Writer';
import { log } from './../../../utilities';

interface AttributeWidgetConfig {
  writer: Writer;
  $el: JQuery<HTMLElement>;
  $parent?: JQuery<HTMLElement>;
  showSchemaHelp?: boolean;
}

class AttributeWidget {
  static readonly ADD = 0;
  static readonly EDIT = 1;

  readonly writer: Writer;
  readonly $el: JQuery<HTMLElement>; // the el to add the attribute widget to
  readonly $parent?: JQuery<HTMLElement>; // the parent form (optional)
  readonly showSchemaHelp: boolean = false;

  mode: 0 | 1 = 0; //add

  isDirty = false;

  constructor({ writer, $el, $parent, showSchemaHelp = false }: AttributeWidgetConfig) {
    this.writer = writer;
    this.$el = $el;
    this.$parent = $parent;
    this.showSchemaHelp = showSchemaHelp;

    this.$el.addClass('attributeWidget');

    this.$el.append(`<div class="attsContainer"/>`);

    if (this.$parent) {
      // add listeners for other form elements
      $('[data-mapping]', this.$parent).each(
        $.proxy(function (index: number, element: HTMLElement) {
          const formEl = $(element);
          const type = formEl.data('type');
          const mapping = formEl.data('mapping');

          // check the mapping to make sure it's an attribute
          // TODO if the data-type is hidden then the attribute should not be modifiable in this widget
          if (mapping.indexOf('custom.') === -1 && mapping.indexOf('prop.') === -1) {
            let changeEl;
            if (type === 'radio') {
              changeEl = $('input', formEl);
            } else if (type === 'textbox' || type === 'select') {
              changeEl = formEl;
            }

            if (changeEl) {
              changeEl.on(
                'change',
                $.proxy(
                  function (mapping: any, event: any) {
                    const dataObj: Record<string, any> = {};
                    dataObj[mapping] = $(event.target).val();
                    this.setData(dataObj);
                  },
                  this,
                  mapping,
                ),
              );
            }
          }
        }, this),
      );
    }
  }

  buildWidget(atts: any[], initialVals: any = {}, tag?: string) {
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
    atts = atts.toSorted((a, b) => {
      if (a.name > b.name) return 1;
      if (a.name < b.name) return -1;
      return 0;
    });

    // build atts
    let attsString = '';
    let attributeSelector = '';
    let isRequired = false;

    for (const att of atts) {
      //skip disallowedAttributes
      // if (disallowedAttributes[att.name]) continue;
      if (RESERVED_ATTRIBUTES.has(att.name)) continue;

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
      attributeSelector += this.createAttributeSelector(
        att.name,
        displayName,
        requiredClass,
        initialVals[att.name],
      );

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

      if ($(currentTarget).hasClass('selected')) {
        div.show();
      } else {
        div.hide();
      }
    });

    //Handle field inputs events
    $('input, select, option', this.$el).on('change', () => {
      this.isDirty = true;
    });

    $('select, option', this.$el).on('click', () => {
      this.isDirty = true;
    });
  }

  private sortAttributes(atts: any[]) {
    const sortedAtts = atts.sort((a, b) => {
      if (a.name > b.name) {
        return 1;
      } else if (a.name < b.name) {
        return -1;
      }
      return 0;
    });

    return sortedAtts;
  }

  private addHelpButton(documentation?: string, cssOnly = true) {
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

  private addSelectInput(attributeName: string, choices: string[], defaultValue = '') {
    return `<select name="${attributeName}">
      ${choices
        .map((attVal) => {
          const selected = defaultValue == attVal ? ' selected="selected"' : '';
          return `<option value="${attVal}"${selected}>${attVal}</option>`;
        })
        .join('\n')}
    </select>`;
  }

  private addTextInput(attributeName: string, defaultValue = '') {
    return `<input type="text" name="${attributeName}" value="${defaultValue}"/>`;
  }

  private createAttributeField({
    attributeName,
    choices,
    displayCSS = 'flex',
    displayName,
    defaultValue,
    documentation,
    isRequired = false,
  }: {
    attributeName: string;
    choices?: string[];
    displayCSS?: 'flex' | 'none';
    displayName: string;
    defaultValue?: string;
    documentation?: string | any[];
    isRequired?: boolean;
  }) {
    // console.log(displayName);
    // TODO add list support
    // if ($('list', attDef).length > 0) {
    //   currAttString += '<input type="text" name="'+att.name+'" value="'+att.defaultValue+'"/>';

    //input
    const inputHTML =
      choices && choices.length > 0
        ? this.addSelectInput(attributeName, choices, defaultValue)
        : this.addTextInput(attributeName, defaultValue);

    const documentText: string | string[] = documentation
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
      : '';

    const htmlPart = `
      <div data-name="form_${attributeName}" class="attribute" style="display:${displayCSS};">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; flex-direction: row; align-items: baseline; width: 100%;">
            <label class="fieldLabel">
              ${displayName}
            </label>
            ${isRequired ? '<span class="required">*</span>' : ''}
          </div>
          ${inputHTML}
          ${
            documentText
              ? `<span style="font-size: 0.7rem; color: #666;">${documentText}</span>`
              : ''
          }
        </div>
      </div>
    `;

    return htmlPart;
  }

  private createAttributeSelector(
    attributeName: string,
    displayName: string,
    requiredClass: string,
    isInitial = false,
  ) {
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
  setData(data: Record<string, any>) {
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
  setAttribute(name: string, value?: string) {
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
    } else {
      li.removeClass('selected');
      const div = $(`[data-name="form_${name}"]`, this.$parent);
      $('input, select', div).val('');
      div.hide();
    }

    return true;
  }

  /**
   * Collects the data from the attribute widget and performs validation.
   */
  getData() {
    const attributes = new Map<string, string>();

    const selectedAttributes = this.$parent?.[0].querySelectorAll(`.attributeSelector li.selected`);
    selectedAttributes?.forEach((el) => {
      const name = (el as HTMLElement).dataset.name;
      if (!name) return;

      const element = this.$el[0].querySelector(`[data-name="form_${name}"]`);
      const input = element?.querySelector('input, select');
      if (!input) return;

      const inputElement = input as HTMLInputElement | HTMLSelectElement;
      const attributeName = inputElement.name;
      const value = inputElement.value;
      if (value !== '') attributes.set(attributeName, value);
    });

    // validation
    const invalid: string[] = [];
    this.$el[0]
      .querySelector('.attsContainer span.required')
      ?.parentElement?.querySelectorAll('input[type!="hidden"], select')
      .forEach((el) => {
        const attrName = el.getAttribute('name');
        if (!attrName) return;

        const entry = attributes.get(attrName);
        if (!entry || entry === '') invalid.push(attrName);
      });

    //highlight invalid
    invalid.forEach((name) => {
      $(`.attsContainer *[name="${name}"]`, this.$el)
        .css({ borderColor: 'red' })
        .on('keyup', () => {
          $(this).css({ borderColor: '#ccc' });
        });
    });

    return Object.fromEntries(attributes);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  destroy() {}
}

export default AttributeWidget;
