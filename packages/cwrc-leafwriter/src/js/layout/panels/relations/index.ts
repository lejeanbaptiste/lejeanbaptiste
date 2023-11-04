import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import Writer from '../../../Writer';

interface RelationsProps {
  parentId: string;
  writer: Writer;
}

class Relations {
  readonly id: string;
  readonly writer: Writer;

  readonly $relations: JQuery<HTMLElement>;
  readonly $addButton: JQuery<HTMLElement>;
  readonly $removeButton: JQuery<HTMLElement>;

  currentlySelectedNode: any | null = null;

  constructor({ parentId, writer }: RelationsProps) {
    this.writer = writer;
    this.id = parentId;

    $(`#${this.id}`).append(`
      <div class="moduleParent">
        <ul class="moduleContent relationsList"></ul>
        <div class="moduleFooter">
          <button type="button" role="add">Add Relation</button>
          <button type="button" role="remove">Remove Relation</button>
        </div>
      </div>
    `);

    this.$relations = $(`#${this.id}`);

    //@ts-ignore
    this.$addButton = this.$relations.find('.moduleFooter button[role=add]').button();
    //@ts-ignore
    $addButton.click(() => this.writer.dialogManager.show('triple'));

    //@ts-ignore
    this.$removeButton = this.$relations.find('.moduleFooter button[role=remove]').button();
    this.$removeButton.on('click', () => {
      const selected = this.$relations.find('ul li.selected');

      const index = selected.data('index');
      if (selected.length !== 1) {
        this.writer.dialogManager.show('message', {
          title: 'No Relation Selected',
          msg: 'You must first select a relation to remove.',
          type: 'error',
        });
        return;
      }

      this.writer.triples.splice(index, 1);
      this.update();
    });

    //@ts-ignore
    $.contextMenu({
      selector: `#${this.id} ul li`,
      zIndex: 10,
      appendTo: `#${this.writer.containerId}`,
      className: 'cwrc',
      items: {
        remove: {
          name: 'Remove Relation',
          icon: 'tag_remove',
          callback: (key: any, opt: any) => {
            const index = opt.$trigger.data('index');
            this.writer.triples.splice(index, 1);
            this.update();
          },
        },
      },
    });

    this.writer.event('loadingDocument').subscribe(() => this.clear());
    this.writer.event('documentLoaded').subscribe(() => this.update());
    this.writer.event('schemaLoaded').subscribe(() => this.update());

    // add to writer
    //@ts-ignore
    this.writer.relations = this;
  }

  /**
   * Update the list of relations.
   */
  update() {
    this.clear();

    let relationsString = '';

    for (let i = 0; i < this.writer.triples.length; i++) {
      //@ts-ignore
      const { subject, predicate, object } = this.writer.triples[i];
      //@ts-ignore
      relationsString += `<li> ${subject.text} ${predicate.text} ${object.text}</li>`;
    }

    this.$relations.find('ul').html(relationsString);

    this.$relations
      .find('ul li')
      .each(function (index, el) {
        $(this).data('index', index);
      })
      .on('click', function () {
        $(this).addClass('selected').siblings().removeClass('selected');
      });
  }

  clear() {
    this.$relations.find('ul').empty();
  }

  destroy() {
    //@ts-ignore
    this.$addButton.button('destroy');
    //@ts-ignore
    this.$removeButton.button('destroy');
    $(`#${this.id}_contextMenu`).remove();
  }
}

export default Relations;
