import type {
  NodeDetail,
  ErrorNames,
  ValidationError,
  ValidationErrorElement,
  ValidationErrorTarget,
  ValidationResponse,
} from '@cwrc/leafwriter-validator';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/widgets/tooltip';
import ProgressBar from 'progressbar.js';
import Circle from 'progressbar.js/circle';
import Writer from '../../../Writer';

interface ValidationProps {
  parentId: string;
  writer: Writer;
}

class Validation {
  readonly id: string;
  readonly writer: Writer;

  readonly AUTO_VALIDATE_ONCHANGE_TIMER = 10000;
  autoValidateTimerActive = false;
  autoValidateTimer: ReturnType<typeof setTimeout>;

  progressBar?: Circle; //typeof ProgressBar | null = null;

  constructor({ parentId, writer }: ValidationProps) {
    this.writer = writer;
    this.id = this.writer.getUniqueId('validation_');

    $(`#${parentId}`).append(`
			<div class="moduleParent">
				<div id="${this.id}" class="moduleContent">
					<div class="validationList"/>
				</div>
        <div id="${this.id}_buttons" class="moduleFooter">
          <div class="stats" style="text-align: center;">
          </div>
        </div>
			</div>
    `);

    this.writer.event('contentChanged').subscribe(() => {
      this.autoValidateTimerActive
        ? clearTimeout(this.autoValidateTimer)
        : (this.autoValidateTimerActive = true);

      this.autoValidateTimer = setTimeout(() => {
        this.validate();
        this.autoValidateTimerActive = false;
      }, this.AUTO_VALIDATE_ONCHANGE_TIMER);
    });

    this.writer.event('documentLoaded').subscribe(() => {
      this.clearResult();
      const hasValidorHasSchema = writer.overmindState.validator.hasSchema;
      if (hasValidorHasSchema) this.writer.validate();
    });

    this.writer.event('workerValidatorLoaded').subscribe(() => {
      this.clearResult();
      if (writer.isDocLoaded) this.writer.validate();
    });

    this.writer.event('validationRequested').subscribe(() => {
      const list = $(`#${this.id} > div.validationList`);
      list.empty();

      const loader = `
        <div id="validation-progress">
          <div id="validation-progress-bar"/>
        </div>
      `;
      list.append(loader);

      this.progressBar = new ProgressBar.Circle('#validation-progress-bar');

      this.validate();
    });

    this.writer
      .event('documentValidated')
      .subscribe((valid: boolean, result: ValidationResponse) => {
        $(`#${this.id}_indicator`).hide();
        this.showValidationResult(result);
        if (result.errors) this.writer.layoutManager.showModule('validation');
      });

    this.writer.event('documentValidating').subscribe((partDone: number) => {
      const pct = `${Math.floor(partDone * 100)}%`;
      this.progressBar?.set(partDone);
      this.progressBar?.setText(pct);
    });

    // add to writer
    this.writer.validation = this;
  }

  async validate() {
    await this.writer.overmindActions.validator.validate();
  }

  /**
   * Processes a validation response from the server.
   * @param result {object} The actual response
   * @param result.valid {boolean} Whether the document is valid or not
   * @param result.errors {array} List of errors
   */
  showValidationResult({ valid, errors }: ValidationResponse) {
    const list = $(`#${this.id} > div.validationList`);
    list.empty();

    if (valid) {
      list.append(this.createSucessMessageComponent());

      //@ts-ignore
      const $validateButton = $(`.revalidate-bt`).button();
      $validateButton.on('click', () => this.writer.validate());

      return;
    }

    const _this = this;

    this.writer.layoutManager.showModule('validation');

    this.writer.tagger.removeNoteWrappersForEntities();

    errors.forEach((error) => {
      // convert xpath to jquery selector
      const path = this.getElementPathOnEditor(error.target.xpath ?? error.element.xpath);
      const docEl = $(path, this.writer.editor?.getBody());
      const id = docEl.attr('id') ?? null;

      //build compontent
      const errorComponent = this.createErrorMessageComponent(error);

      //append element
      const item = list.append(errorComponent.html).find('li:last');
      item.data('id', id);
      item.data('data', errorComponent.data);

      item.find('.expandButton').on('click', function (event) {
        const parentContainer = $(this).parent().parent();
        const opened = parentContainer.hasClass('selected');
        if (!opened) return;

        event.stopImmediatePropagation();

        $(this).find('i').removeClass('icon-rotate-180').addClass('icon-rotate-0');
        parentContainer.find('#details').empty();
        parentContainer.removeClass('selected');
      });
    });

    const $stats = $(`.moduleFooter > div.stats`);
    $stats.empty();
    $stats.append(`
    <div id="stats-container">
      <div id="info" title="Rerun validator">
        <i class="fas fa-exclamation-circle"></i>
        ${errors.length}
      </div>
     </div>
    `);

    //@ts-ignore
    const $infoBadge = $stats.find('#info').button();
    $infoBadge.on('click', () => this.writer.validate());

    $infoBadge.on('mouseover', (event: JQuery.MouseOverEvent) => {
      const $icon = $(event.currentTarget).find('i');
      $icon.toggleClass('fa-exclamation-circle', false);
      $icon.toggleClass('fa-arrow-rotate-right', true);
    });

    $infoBadge.on('mouseout', (event: JQuery.MouseOutEvent) => {
      const $icon = $(event.currentTarget).find('i');
      $icon.toggleClass('fa-exclamation-circle', true);
      $icon.toggleClass('fa-arrow-rotate-right', false);
    });

    this.writer.tagger.addNoteWrappersForEntities();

    list.find('li').on('click', function () {
      const id: string = $(this).data('id');
      _this.writer.utilities.selectElementById(id);

      if ($(this).hasClass('selected')) return;

      _this.collapseAll();
      $(this).addClass('selected');
      $(this).find('.expandButton i').removeClass('icon-rotate-0').addClass('icon-rotate-180');

      _this.createDocumentationComponent($(this));
    });
  }

  private collapseAll() {
    const list = $(`#${this.id} > div.validationList`);
    list.find('li').each(function () {
      $(this).find('#details').empty();
      $(this).removeClass('selected');
      $(this).find('.expandButton > i').removeClass('icon-rotate-180').addClass('icon-rotate-0');
    });
  }

  private createSucessMessageComponent(): string {
    return `
      <div
        style="
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 8px;
          height: 100%;
          font-weight: 700;
          color: #777;
        "
      >
        <svg
          aria-hidden="true"
          focusable="false"
          data-prefix="far"
          data-icon="check-circle"
          class="svg-inline--fa fa-check-circle fa-w-16"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          style="width: 6rem; opacity: 0.15";
        >
          <path
            fill="currentColor"
            d="M256 8C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 48c110.532 0 200 89.451 200 200 0 110.532-89.451 200-200 200-110.532 0-200-89.451-200-200 0-110.532 89.451-200 200-200m140.204 130.267l-22.536-22.718c-4.667-4.705-12.265-4.736-16.97-.068L215.346 303.697l-59.792-60.277c-4.667-4.705-12.265-4.736-16.97-.069l-22.719 22.536c-4.705 4.667-4.736 12.265-.068 16.971l90.781 91.516c4.667 4.705 12.265 4.736 16.97.068l172.589-171.204c4.704-4.668 4.734-12.266.067-16.971z"
          >
        </path>
      </svg>
        <span>Document is valid!</span>
        <div class="revalidate-bt">
          <i class="fas fa-redo-alt"></i>
        </div>
      </div>
    `;
  }

  private getElementPathOnEditor(xpath: string) {
    let editorPath = '';
    const tags = xpath.split('/');

    for (const tag of tags) {
      const tagName = tag.match(/^\w+(?=\[)?/);

      if (tagName !== null) {
        let index: RegExpMatchArray | number | null = tag.match(/\[(\d+)\]/);

        if (index === null) {
          index = 0;
        } else {
          index = parseInt(index[1]);
          index--; // xpath is 1-based and "eq()" is 0-based
        }

        //accumulates
        editorPath += `*[_tag="${tagName[0]}"]:eq(${index}) > `;
      }
    }

    editorPath = editorPath.substr(0, editorPath.length - 3); //remove final xpath index?

    return editorPath;
  }

  private createErrorMessage({ type, msg, target, element }: ValidationError) {
    switch (type) {
      case 'ElementNameError':
        msg = `Tag
        <span
          class="element"
          ${target.fullName ? `data-tooltip="${target.fullName}"` : ''}
        >
          ${target.name}
        </span>
        not allowed in
        <span
          class="element"
          ${element.fullName ? `data-tooltip="${element.fullName}"` : ''}
        >
          ${element.name}
        </span>
      `;
        break;

      case 'AttributeNameError':
        msg = `Attribute
        <span
          class="element"
          ${target.fullName ? `data-tooltip="${target.fullName}"` : ''}
        >
          ${target.name}
        </span>
        not allowed in
        <span
          class="element"
          ${element.fullName ? `data-tooltip="${element.fullName}"` : ''}
        >
          ${element.name}
        </span>
      `;
        break;

      case 'AttributeValueError':
        msg = `Invalid attribute value for 
        <span
          class="element"
          ${target.fullName ? `data-tooltip="${target.fullName}"` : ''}
        >
          ${target.name}
        </span>
        in
        <span
          class="element"
          ${element.fullName ? `data-tooltip="${element.fullName}"` : ''}
        >
          ${element.name}
        </span>
      `;
        break;

      case 'ValidationError':
        msg = `Text not allowed in  
        <span
          class="element"
          ${element.fullName ? `data-tooltip="${element.fullName}"` : ''}
        >
          ${element.name}
        </span>
      `;
        break;
    }

    return msg;
  }

  private createErrorMessageComponent(data: ValidationError): {
    html: string;
    data: ValidationError;
  } {
    const { type }: ValidationError = data;
    const errorMessage = this.createErrorMessage(data);

    const html = `
      <li>
        <div id="header">
          <div id="headerIcon">
            <i
              class="fas fa-exclamation-${type === 'ValidationError' ? 'triangle' : 'circle'}"
            />
          </div>
          <div style="flex-grow: 1;">
            ${errorMessage}
          </div>
          <div class="expandButton">
            <i class="fas fa-angle-down" style="font-size: 0.9em;"/>
          </div>
        </div>
        <div id="details"></div>
      </li>
    `;

    return { html, data };
  }

  private async createDocumentationComponent($item: JQuery<HTMLElement>) {
    const { target, element }: ValidationError = $item.data().data;

    $($item).show();
    const $details = $item.find('#details');

    const html = `
      <div class="documentation">
        ${
          target.name
            ? `<div class="text">
                <u>${target.name}</u>: ${target.documentation}
              </div>`
            : ''
        }
        <div class="text">
          <u>${element.name}</u>: ${element.documentation}
        </div>
      </div>
      <div class="possible"></div>
      <div class="xpath">
        <u>XPath</u>: ${target.xpath ?? element.xpath}
      </div>
    `;

    $details.append(html);

    let possibilities: NodeDetail[];
    if ($item.data().data.possibilities) {
      possibilities = $item.data().data.possibilities;
    } else {
      possibilities = await this.getPossible($item.data().data);
      const data = $item.data().data;
      data.possibilities = possibilities;
      $item.data('data', data);
    }

    if (!possibilities) return;

    const $possibleHTML = $item.find('.possible');
    let possibleItems = '<span>Expected </span>';

    possibilities.forEach((value) => {
      const { fullName, name } = value;
      possibleItems += `
        <span class="element" ${fullName ? `data-tooltip="${fullName}"` : ''}>
          ${name}
        </span>
      `;
    });

    $possibleHTML.append(possibleItems);
  }

  private async getPossible({
    type,
    target,
    element,
  }: {
    type: ErrorNames;
    target: ValidationErrorTarget;
    element: ValidationErrorElement;
  }): Promise<NodeDetail[]> {
    switch (type) {
      case 'ElementNameError':
        return this.writer.overmindActions.validator.getNodesForTagAt({
          xpath: element.xpath,
          index: target.index,
        });

      case 'AttributeNameError':
        return this.writer.overmindActions.validator.getAttributesForTagAt({
          xpath: element.parentElementXpath,
          index: element.parentElementIndex,
        });

      case 'AttributeValueError':
        return this.writer.overmindActions.validator.getValuesForTagAttributeAt({
          xpath: target.xpath,
        });

      default:
        return;
    }
  }

  clearResult = () => {
    $(`#${this.id}_indicator`).hide();
    $(`#${this.id} > div.validationList`).empty();
  };

  destroy = () => {
    if (this.progressBar) this.progressBar.destroy();
  };
}

export default Validation;
