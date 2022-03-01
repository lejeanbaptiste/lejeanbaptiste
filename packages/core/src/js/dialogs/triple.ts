import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import '../../lib/jquery/jquery.watermark.min';
import Entity from '../entities/Entity';
import Writer from '../Writer';

interface IPredicateList {
  person: string[];
  place: string[];
}

interface IComponent {
  external: boolean;
  name?: string;
  text: string;
  uri?: string;
}

export interface ITriple {
  subject: IComponent;
  predicate: IComponent;
  object: IComponent;
}

const predicateList: IPredicateList = {
  person: ['is a child of', 'is a parent of', 'is related to', 'was born on', 'died on'],
  place: ['is located within', 'contains'],
};

class Triple {
  readonly writer: Writer;
  readonly $triple: JQuery<HTMLElement>;

  readonly $subject: JQuery<HTMLElement>;
  readonly $predicate: JQuery<HTMLElement>;
  readonly $object: JQuery<HTMLElement>;

  constructor(writer: Writer, parentEl: JQuery<HTMLElement>) {
    this.writer = writer;

    this.$triple = $(`
      <div class="triplesDialog">
        <div class="columns">

          <div class="column">
            <h2>Subject</h2>
            <ul class="entitiesList"></ul>
            <div class="customEntry">
              <input type="text" name="customSubject" value="" />
            </div>
          </div>

          <div class="column predicate">
            <h2>Predicate</h2>
            <ul></ul>
            <div class="customEntry">
              <input type="text" name="customPredicate" value="" />
            </div>
          </div>

          <div class="column">
            <h2>Object</h2>
            <ul class="entitiesList"></ul>
            <div class="customEntry">
              <input type="text" name="customObject" value="" />
            </div>
          </div>

        </div>

        <div class="currentRelation">
          <p></p>
          <button type="button">Add Relation</button>
        </div>
      </div>
    `).appendTo(parentEl);

    //@ts-ignore
    this.$triple.dialog({
      title: 'Add Relation',
      modal: true,
      resizable: true,
      closeOnEscape: true,
      height: 450,
      width: 600,
      position: { my: 'center', at: 'center', of: this.writer.layoutManager.getContainer() },
      autoOpen: false,
      buttons: {
        //@ts-ignore
        Close: () => this.$triple.dialog('close'),
      },
    });

    this.$subject = $('.column:eq(0)', this.$triple);
    this.$predicate = $('.column:eq(1)', this.$triple);
    this.$object = $('.column:eq(2)', this.$triple);

    //@ts-ignore
    $('input', this.$subject).watermark('Custom Subject');
    //@ts-ignore
    $('input', this.$predicate).watermark('Custom Predicate');
    //@ts-ignore
    $('input', this.$object).watermark('Custom Object');

    const _this = this;

    $('input', this.$triple).on('keyup', function () {
      $(this).parents('.column').find('li').removeClass('selected');
      _this.updateRelationString();
    });

    $('.currentRelation button', this.$triple)
      //@ts-ignore
      .button({ disabled: true })
      .click(() => {
        const components = this.getComponents();
        const subject = components[0];
        const predicate = components[1];
        const object = components[2];

        if (!subject || !predicate || !object) {
          console.warn(`subject or predicate or object is null:`, subject, predicate, object);
          return;
        }

        const triple: ITriple = {
          subject,
          predicate: {
            text: predicate.text,
            name: this.getPredicateName(predicate.text),
            external: predicate.external,
          },
          object,
        }
        
        this.writer.triples.push(triple);
        //@ts-ignore
        this.writer.relations.update();
      });
  }

  private loadPredicates(type: 'person' | 'place') {
    $('.predicate > ul', this.$triple).empty();

    const predicates = predicateList[type] || ['is associated with'];

    const predicateString = predicates
      .map((predicate) => {
        return `<li>${predicate}</li>`;
      })
      .join('\n');

    $('.predicate > ul', this.$triple).html(predicateString);

    const _this = this;

    $('.predicate > ul li', this.$triple).on('click', function () {
      $(this).siblings('li').removeClass('selected');
      $(this).toggleClass('selected');
      $(this).parents('.column').find('input').val('');

      _this.updateRelationString();
    });
  }

  private getPredicateName(str: string) {
    const strs = str.split(/\s/);
    let name = '';
    for (let i = 0; i < strs.length; i++) {
      if (i == 0) {
        name += strs[i].toLowerCase();
      } else {
        name += strs[i].replace(/^./, function (s) {
          return s.toUpperCase();
        });
      }
    }
    return name;
  }

  private getComponents() {
    const _this = this;
    //@ts-ignore
    const components: IComponent[] = [null, null, null];

    $('ul', this.$triple).each(function (index) {
      const s = $(this).find('.selected');

      if (s.length === 1) {
        let uri = '';
        const id = s.attr('name');

        //@ts-ignore
        if (id) uri = _this.writer.entitiesManager.getEntity(id).getUris().annotationId;

        components[index] = {
          text: _this.writer.utilities.escapeHTMLString(s.text()),
          uri: uri,
          external: false,
        };
      }
    });

    $('input', this.$triple).each((index) => {
      const val = $(this).val();
      if (val !== '')
        components[index] = {
          text: _this.writer.utilities.escapeHTMLString(val),
          uri: _this.writer.utilities.escapeHTMLString(val),
          external: true,
        };
    });

    return components;
  }

  private updateRelationString() {
    const components = this.getComponents();
    let str = '';
    let enable = true;

    for (let i = 0; i < components.length; i++) {
      const c = components[i];

      if (c === null) {
        enable = false;
      } else {
        str += c.text;
        str += i < 2 ? ' ' : '.';
      }
    }

    $('.currentRelation p', this.$triple).html(str);

    const enabledSwitch = enable ? 'enabled' : 'disable';
    //@ts-ignore
    $('.currentRelation button', this.$triple).button(enabledSwitch);
  }

  private buildEntity(entity: Entity) {
    return `
      <li class="${entity.getType()}" name="${entity.getId()}">
        <span class="box"/>
        <span class="entityTitle">
          ${entity.getContent()}
        </span>
      </li>
    `;
  }

  show() {
    const _this = this;

    $('.column > ul', this.$triple).empty();
    $('.currentRelation p', this.$triple).html('');

    let entitiesString = '';

    this.writer.entitiesManager.eachEntity((id: any, entity: Entity) => {
      entitiesString += this.buildEntity(entity);
    });

    $('ul', this.$subject).html(entitiesString);
    $('ul', this.$object).html(entitiesString);
    $('.entitiesList > li', this.$triple)
      .on('mouseenter', function () {
        if (!$(this).hasClass('selected')) $(this).addClass('over');
      })
      .on('mouseleave', function () {
        if (!$(this).hasClass('selected')) $(this).removeClass('over');
      })
      .on('click', function (event) {
        $(this).siblings('li').removeClass('selected');
        $(this).removeClass('over').toggleClass('selected');
        $(this).parents('.column').find('input').val('');

        if (_this.$subject.find(this).length > 0) {
          if ($(this).hasClass('selected')) {
            const attributeName = $(this).attr('name');
            if (attributeName) {
              const type = _this.writer.entitiesManager.getEntity(attributeName).getType();
              if (type === 'person' || type === 'place') _this.loadPredicates(type);
            }
          } else {
            $('ul', _this.$predicate).empty();
          }
        }

        _this.updateRelationString();
      });

    //@ts-ignore
    this.$triple.dialog('open');
  }

  destroy() {
    //@ts-ignore
    this.$triple.dialog('destroy');
  }
}

export default Triple;
