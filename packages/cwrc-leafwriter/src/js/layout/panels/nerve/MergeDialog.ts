import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/widgets/selectmenu';
// import { doLookup } from './util';

function MergeDialog(writer: any, parentEl: HTMLElement) {
  let currEntities: any[] = [];
  let currEntry: any = null; // for editing
  const OTHER_OPTION = '$$$$OTHER$$$$';

  const $el = $(`
    <div class="annotationDialog">
      <div class="selections">
        <h3>Selections</h3>
        <ul></ul>
        </div>
          <div>
            <div class="lemma">
              <label>Standard name:</label>
              <select name="lemma"></select>
            </div>
            <div style="margin-top: 5px;">
              <label>Other name:</label>
              <input name="otherLemma" type="text" />
            </div>
          </div>
          <div>
            <div class="link">
            <label>URI:</label>
            <select name="link"></select>
          </div>
          <div style="margin-top: 5px;">
          <label>Other URI:</label>
          <input name="otherLink" type="text" style="margin-right: 5px;"/>
          <button type="button" title="Entity lookup" data-action="lookup">
            <i class="fas fa-search icon"></i>
          </button>
        </div>
      </div>
    </div>`).appendTo(parentEl);

  //@ts-ignore
  $el.dialog({
    title: 'Merge Entities',
    modal: false,
    resizable: true,
    closeOnEscape: false,
    height: 500,
    width: 400,
    position: { my: 'center', at: 'center', of: writer.layoutManager.getContainer() },
    autoOpen: false,
    buttons: [
      {
        text: 'Merge',
        click: () => {
          let lemma = $el.find('select[name=lemma]').val();
          let link = $el.find('select[name=link]').val();
          if (lemma === OTHER_OPTION) lemma = $el.find('input[name=otherLemma]').val();
          if (link === OTHER_OPTION) link = $el.find('input[name=otherLink]').val();
          $el.trigger('merge', [currEntities, currEntry, lemma, link]);
          //@ts-ignore
          $el.dialog('close');
        },
      },
      {
        text: 'Cancel',
        click: () => {
          $el.trigger('cancel');
          //@ts-ignore
          $el.dialog('close');
        },
      },
    ],
  });

  $el
    .find('button[data-action=lookup]')
    //@ts-ignore
    .button({ icon: 'fas fa-search icon' })
    .on('click', function () {
      const query = currEntities[0].getContent();
      const type = currEntities[0].getType();
      // doLookup(writer, query, type, (result: any) => {
      //   $el.find('input[name=otherLink]').val(result.uri);
      // });
    });

  const reset = function () {
    $el.find('ul').empty();
    $el
      .find('select')
      .empty()
      .each((index, el) => {
        //@ts-ignore
        if ($(el).selectmenu('instance') !== undefined) {
          //@ts-ignore
          $(el).selectmenu('destroy');
        }
      });

    $el.find('input[name=otherLemma]').val('').parent().hide();
    $el.find('input[name=otherLink]').val('').parent().hide();
  };

  const populate = (entities: any[], entry: any) => {
    currEntities = entities;
    currEntry = entry;

    let selections = '';
    const lemmas: any[] = [];
    const links: any[] = [];

    entities.forEach((ent) => {
      selections += `<li>${ent.getContent()}</li>`;
      const lemma = ent.getLemma();
      if (lemma !== undefined && lemmas.indexOf(lemma) === -1) {
        lemmas.push(lemma);
      }
      const link = ent.getURI();
      if (link !== undefined && links.indexOf(link) === -1) {
        links.push(link);
      }
    });

    let otherLemma = lemmas.length === 0;
    let lemmaString = '';

    lemmas.forEach(function (lemma) {
      lemmaString += `<option value="${lemma}">${lemma}</option>`;
      if (entry !== undefined && entry.lemma !== lemma) {
        otherLemma = true;
      }
    });
    lemmaString += `<option value="${OTHER_OPTION}">Other (specify)</option>`;

    let otherLink = links.length === 0;
    let linkString = '';
    links.forEach(function (link) {
      linkString += `<option value="${link}">${link}</option>`;
      if (entry !== undefined && entry.uri !== link) {
        otherLink = true;
      }
    });
    linkString += `<option value="${OTHER_OPTION}">Other (lookup)</option>`;
    if (links.length === 0) {
      $el.find('input[name=otherLink]').parent().show();
    }

    $el.find('ul').html(selections);

    $el
      .find('select[name=lemma]')
      .html(lemmaString)
      //@ts-ignore
      .selectmenu({
        select: (event: any, ui: any) => {
          ui.item.value === OTHER_OPTION
            ? $el.find('input[name=otherLemma]').parent().show()
            : $el.find('input[name=otherLemma]').parent().hide();
        },
      });

    $el
      .find('select[name=link]')
      .html(linkString)
      //@ts-ignore
      .selectmenu({
        select: (event: any, ui: any) => {
          ui.item.value === OTHER_OPTION
            ? $el.find('input[name=otherLink]').parent().show()
            : $el.find('input[name=otherLink]').parent().hide();
        },
      });

    if (entry !== undefined) {
      if (otherLemma) {
        //@ts-ignore
        $el.find('select[name=lemma]').val(OTHER_OPTION).selectmenu('refresh');
        $el.find('input[name=otherLemma]').val(entry.lemma).parent().show();
      } else {
        $el.find('select[name=lemma]').val(entry.lemma);
      }

      if (otherLink) {
        //@ts-ignore
        $el.find('select[name=link]').val(OTHER_OPTION).selectmenu('refresh');
        $el.find('input[name=otherLink]').val(entry.uri).parent().show();
      } else {
        $el.find('select[name=link]').val(entry.uri);
      }
    }
  };

  return {
    show: () => {
      reset();
      //@ts-ignore
      $el.dialog('open');
    },
    $el: $el,
    populate: populate,
  };
}

export default MergeDialog;
