import axios from 'axios';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/widgets/selectmenu';
import 'jquery-ui/ui/widgets/tooltip';
import { log } from '../../../../utilities';
import MergeDialog from './MergeDialog';
import NerveEditDialog from './NerveEditDialog';

interface NerveConfig {
  writer: any;
  parentId: string;
  nerveUrl: string;
}

interface MergedEntities {
  entityIds?: string[];
  lemma?: string;
  type?: string;
  uri?: string;
}

interface NerveToCWRCMappings {
  PERSON: string;
  LOCATION: string;
  ORGANIZATION: string;
  TITLE: string;
}

const NerveToCWRCMappings: NerveToCWRCMappings = {
  PERSON: 'person',
  LOCATION: 'place',
  ORGANIZATION: 'organization',
  TITLE: 'title',
};

interface TagProps {
  name?: string;
  lemmaAttribute?: string;
  linkAttribute?: string;
  idAttribute?: string;
  defaults?: Record<string, string>;
  lemma?: string;
  uri?: string;
  type?: string;
}

type Itags = Record<string, TagProps>;

interface ContextProps {
  name: string;
  tags: Itags;
}

const iconsMap = new Map([
  ['person', 'user'],
  ['place', 'globe'],
  ['org', 'users'],
  ['title', 'book'],
  ['rs', 'box-open'],
  ['citation', 'address-card'],
  ['note', 'sticky-note'],
  ['date', 'calendar-alt'],
  ['correction', 'info-circle'],
  ['keyword', 'key'],
  ['link', 'link'],
]);

const NSSI_API_BASE_URL = 'https://api.nssi.dev.lincsproject.ca/api';

/**
 * @class Nerve
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 * @param {String} config.nerveUrl
 */
function Nerve({ writer, parentId, nerveUrl }: NerveConfig) {
  if (nerveUrl === undefined) log.error('Nerve: no nerveUrl specified!');

  const id = parentId;

  /**
   * Tracks the merged entities.
   * @type {Object}
   * @property {Array} entityIds
   * @property {String} type
   * @property {String} lemma
   * @property {String} uri
   */
  let mergedEntities: MergedEntities = {};

  let editDialog: any = null; // holder for initialized edit dialog
  let mergeDialog: any = null; // holder for initialized merge dialog
  let isMerge = false; // are we in merge mode
  let runOptions = []; // what options did the user select when running nerve

  const $parent = $(`#${id}`);
  $parent.append(`
    <div class="moduleParent nervePanel">
      <div class="moduleHeader">
        <div style="display: flex; justify-content: center;">
          <select name="processOptions">
            <option value="tag">Entity Recognition</option>
            <!--<option value="both">Recognition & Linking</option>
            <option value="link">Linking Only</option>-->
          </select>
          <button type="button" class="run">Run</button>
          <button type="button" class="done" style="display: none;">Done</button>
        </div>
        <div class="filters" style="display: none; margin: 0px;">
          <div style="display: inline-block; margin: 5px;">
            <label for="filter" title="Filter" class="fas fa-filter"></label>
            <select name="filter">
              <option value="all" selected="selected">All</option>
              <optgroup label="Type">
                <option value="type_person">Person</option>
                <option value="type_place">Place</option>
                <option value="type_org">Organization</option>
                <option value="type_title">Title</option>
              </optgroup>
              <optgroup label="Status">
                <option value="status_edited">Edited</option>
                <option value="status_notedited">Not Edited</option>
              </optgroup>
            </select>
          </div>
          <div style="display: inline-block; margin: 5px;">
            <label for="sorting" title="Sorting" class="fas fa-sort"></label>
            <select name="sorting">
              <option value="seq" selected="selected">Sequential</option>
              <option value="alpha">Alphabetical</option>
              <option value="cat">Categorical</option>
            </select>
          </div>
        </div>
        <div class="listActions" style="display: none;">
          <button type="button" class="expand">Expand All</button>
          <button type="button" class="accept">Accept All</button>
          <button type="button" class="reject">Reject All</button>
        </div>
      </div>
      <div class="moduleContent">
        <ul class="entitiesList"></ul>
      </div>
      <div class="moduleFooter" style="display: flex; justify-content: center;">
        <button type="button" class="mergeEntities">Merge Entities</button>
        <div class="mergeActions" style="display: none;">
          <button type="button" class="merge">Merge</button>
          <button type="button" class="cancelMerge">Cancel</button>
        </div>
      </div>
      <div id="dialogReact" />
    </div>
  `);

  //@ts-ignore
  $parent.find('select[name=processOptions]').selectmenu({
    appendTo: writer.layoutManager.getContainer(),
  });

  //@ts-ignore
  $parent.find('.filters select').selectmenu({
    appendTo: writer.layoutManager.getContainer(),
    width: 90,
  });

  // RUN

  $parent
    .find('button.run')
    //@ts-ignore
    .button()
    .on('click', () => run());

  // DONE
  $parent
    .find('button.done')
    //@ts-ignore
    .button()
    .on('click', () => {
      const countEditedEntities = getNerveEntities(true).length;
      const countMergedEntities = Object.keys(mergedEntities).length;
      const totalModified = countEditedEntities + countMergedEntities;

      if (totalModified <= 0) {
        rejectAll(true);
        handleDone();
        return;
      }

      writer.dialogManager.confirm({
        title: 'Warning',
        msg: `
          <p>You are about to lose edits you've made to ${totalModified} Nerve-identified entit${
          totalModified > 1 ? 'ies' : 'y'
        }.</p>
          <p>Do you wish to proceed?</p>
        `,
        // showConfirmKey: 'confirm-reject-nerve-entities',
        noText: 'No, review edited entities',
        type: 'info',
        callback: (doIt: boolean) => {
          if (doIt) {
            rejectAll(true);
            handleDone();
          } else {
            setFilterValue('status_edited');
            filterEntityView('status_edited');
          }
        },
      });
    });

  // FILTER
  $parent.find('select[name="filter"]').on('selectmenuchange', () => {
    filterEntityView(getFilterValue());
  });

  // SORTING
  $parent.find('select[name="sorting"]').on('selectmenuchange', () => {
    renderEntitiesList();
  });

  // EXPAND / COLLAPSE
  $parent
    .find('button.expand')
    //@ts-ignore
    .button()
    .on('click', function () {
      //@ts-ignore
      if ($(this).text() === 'Expand All') {
        //@ts-ignore
        $(this).text('Collapse All');
        $parent.find('.entitiesList > li').each((index, el) => {
          $(el).addClass('expanded');
        });
      } else {
        //@ts-ignore
        $(this).text('Expand All');
        $parent.find('.entitiesList > li').each((index, el) => {
          $(el).removeClass('expanded');
        });
      }
    });

  // ACCEPT ALL
  $parent
    .find('button.accept')
    //@ts-ignore
    .button()
    .on('click', () => acceptAll());

  // REJECT ALL
  $parent
    .find('button.reject')
    //@ts-ignore
    .button()
    .on('click', () => rejectAll());

  // ENTER MERGE MODE
  $parent
    .find('button.mergeEntities')
    //@ts-ignore
    .button({ disabled: true })
    .on('click', () => setMergeMode(true));

  // MERGE DIALOG
  $parent
    .find('.moduleFooter button.merge')
    //@ts-ignore
    .button()
    .on('click', () => mergeEntities());

  // CANCEL MERGE
  $parent
    .find('.moduleFooter button.cancelMerge')
    //@ts-ignore
    .button()
    .on('click', () => setMergeMode(false));

  const run = async () => {
    nrv.reset();

    const document = getBasicXmlDocument();
    const nerveContext = buildContext();

    const options = $parent.find('select[name="processOptions"]').val();

    runOptions = ['tag', 'link'];
    if (options === 'tag') runOptions = ['tag'];
    if (options === 'link') runOptions = ['link'];

    const li = writer.dialogManager.getDialog('loadingindicator');
    li?.setText?.('Contacting NERVE');
    li?.setValue?.(false);
    li?.show();

    const skipServer = true;
    if (skipServer) {
      postProcess(nerveResultsTestSampleLetter);
      return;
    }

    // const response = await requestLegacy(document, nerveContext);
    const response = await requestNssi(document, nerveContext);

    if (!response || response.status === 400) {
      const msg = `
        NERVE server returned an error. Bad request (possibly encode error): ${response.statusText}
      `;
      log.warn(msg);
      li?.hide?.();
      writer.dialogManager.show('message', {
        title: 'Error',
        msg,
        type: 'error',
      });
      return;
    }
    postProcess(response.data);
  };

  const requestNssi = async (document: string, context: ContextProps) => {
    const token = await writer.overmindActions.editor.getNssiToken();

    const response = await axios({
      method: 'post',
      url: `${NSSI_API_BASE_URL}/jobs`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        projectName: 'Sample Lettter',
        format: 'application/tei+xml',
        document,
        workflow: 'stanford_ner',
        authorities: ['VIAF', 'WIKIDATA', 'GEONAMES'],
        context: {
          ORGANIZATION_TAG: 'orgName',
          LOCATION_TAG: 'placeName',
          PERSON_TAG: 'persName',
          TITLE_TAG: 'title',
        },
      },
    });

    log.info(response);

    if (response.status >= 300) {
      log.info(response);
      return response;
    }

    const jobId = response.data.jobId;
    const jobStatus = response.data.status;
    let resultsUri = response.data.resultsUri;

    if (jobStatus !== 'READY') {
      resultsUri = await poolingNssiJob(jobId);
    }

    const results = await getNssiResults({ jobId, resultsUri });
    log.info(results);

    return results;
  };

  const poolingNssiJob = async (jobId: string) => {
    const token = await writer.overmindActions.editor.getNssiToken();
    const apiUrl = 'https://api.nssi.stage.lincsproject.ca/api';
    const interval = 10_000;
    const maxAttempts = 12;
    let attempts = 0;

    const executePoll = async (resolve: any, reject: any) => {
      const response = await axios.get(`${NSSI_API_BASE_URL}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      attempts++;

      log.info(response);
      const data = response.data;

      if (data.status === 'READY') {
        // return resolve(data.resultsUri);
        setTimeout(() => resolve(data.resultsUri), 25000);
        return;
      } else if (attempts === maxAttempts) {
        return reject(new Error('Exceeded max attempts'));
      } else {
        setTimeout(executePoll, interval, resolve, reject);
      }
    };

    return new Promise(executePoll);
  };

  interface IGetNssiResultsParams {
    jobId: string;
    resultsUri: string;
  }

  const getNssiResults = async ({ jobId, resultsUri }: IGetNssiResultsParams) => {
    const token = await writer.overmindActions.editor.getNssiToken();

    // const response = await axios.get(resultsUri, { headers: { Authorization: `Bearer ${token}` } });
    const response = await axios.get(`${NSSI_API_BASE_URL}/results/stanford_ner/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    log.info(response);

    return response;
  };

  const requestLegacy = async (document: string, context: ContextProps) => {
    log.info(context);
    // const apiUrl = `${nerveUrl}/ner`;
    const apiUrl = 'https://cwrc-writer.cwrc.ca/nerve//ner';

    const response = await axios.post(apiUrl, { document, context });
    // .catch((error) => {
    //   log.warn('encoding failed', error);
    //   li.hide();
    //   writer.dialogManager.show('message', {
    //     title: 'Error',
    //     msg: `The NERVE server returned an error: ${error.exception}`,
    //     type: 'error',
    //   });
    //   return null;
    // });

    // log.info(response);
    // if (!response) return;

    return response;
  };

  const postProcess = async (results: any) => {
    log.info(results);
    const li = writer.dialogManager.getDialog('loadingindicator');
    writer.event('massUpdateStarted').publish();

    const doc: XMLDocument | null = writer.utilities.stringToXML(results.document);
    if (!doc) {
      log.warn('nerve.run: could not parse response from NERVE');
      li?.hide?.();
      return;
    }

    const context: ContextProps = JSON.parse(results.context);
    const entities = processNerveResponse(doc, context);

    li?.setText?.('Processing Response');

    writer.tagger.removeNoteWrappersForEntities();
    await writer.utilities.processArray(entities, addEntityFromNerve);
    writer.tagger.addNoteWrappersForEntities();

    li?.hide?.();
    renderEntitiesList();

    writer.event('massUpdateCompleted').publish();

    writer.editor.setMode('readonly');
    $parent.find('button.run').hide();
    $parent.find('button.done').show();

    $parent.find('.filters').show();
    $parent.find('.listActions').show();

    //@ts-ignore
    $parent.find('select[name="processOptions"]').selectmenu('option', 'disabled', true);
    //@ts-ignore
    $parent.find('button.mergeEntities').button('enable');
  };

  // Converts to xml using just the _tag attribute and ignores everything else.
  // We don't want to do a full/normal conversion because of differences between entities in the editor and in the outputted xml.
  const getBasicXmlDocument = () => {
    let xmlString = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-model href="${writer.schemaManager.getRng()}" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>\n`;

    const _nodeToStringArray = (currNode: JQuery<any>) => {
      const tag = currNode.attr('_tag');
      // let array: any[] = [];
      // if (tag !== undefined) {
      //   array = [...array, `<${tag}>`, `</${tag}>`];
      // } else {
      //   array = ['', ''];
      // }

      const array: string[] = tag !== undefined ? [`<${tag}>`, `</${tag}>`] : ['', ''];
      return array;
    };

    const doBuild = (currentNode: JQuery<any>) => {
      const tags = _nodeToStringArray(currentNode);

      if (tags[0] === '<teiHeader>') return; // * skip `<teiheader>` when sending document to NSSI [NERVE]

      xmlString += tags[0];
      currentNode.contents().each((index: number, el: any) => {
        if (el.nodeType === Node.ELEMENT_NODE) {
          doBuild($(el));
        } else if (el.nodeType === Node.TEXT_NODE) {
          xmlString += writer.utilities.convertTextForExport(el.data);
        }
      });
      xmlString += tags[1];
    };

    writer.entitiesManager.highlightEntity();
    const root = writer.schemaManager.getRoot();
    const $body = $(writer.editor.getBody());
    const $rootEl = $body.children(`[_tag=${root}]`);
    doBuild($rootEl);

    xmlString = xmlString.replace(/\uFEFF/g, '');

    return xmlString;
  };

  const buildContext = function () {
    const sm = writer.schemaManager;

    const context: ContextProps = {
      name: sm.getCurrentSchema().id,
      tags: {},
    };

    const respAttr: string = sm.mapper.getResponsibilityAttributeName();

    // for (let nerveTypeName in NerveToCWRCMappings) {
    //   const entityType = NerveToCWRCMappings[nerveTypeName];
    //   context.tags[nerveTypeName] = {
    //     name: sm.mapper.getParentTag(entityType),
    //     lemmaAttribute: sm.mapper.getMappingForProperty(entityType, 'lemma').replace('@', ''),
    //     linkAttribute: sm.mapper.getMappingForProperty(entityType, 'uri').replace('@', ''),
    //     idAttribute: sm.mapper.getIdAttributeName(),
    //     defaults: {},
    //   };
    //   context.tags[nerveTypeName].defaults[respAttr] = 'NERVE';
    //   Object.assign(
    //     context.tags[nerveTypeName].defaults,
    //     sm.mapper.getRequiredAttributes(entityType)
    //   );
    // }

    Object.entries(NerveToCWRCMappings).forEach(([nerveTypeName, entityType]: [string, string]) => {
      const tag: TagProps = {
        name: sm.mapper.getParentTag(entityType),
        lemmaAttribute: sm.mapper.getMappingForProperty(entityType, 'lemma').replace('@', ''),
        linkAttribute: sm.mapper.getMappingForProperty(entityType, 'uri').replace('@', ''),
        idAttribute: sm.mapper.getIdAttributeName(),
      };

      tag.defaults = {};
      tag.defaults[respAttr] = 'NERVE';

      context.tags[nerveTypeName] = tag;

      Object.assign(
        //@ts-ignore
        context.tags[nerveTypeName].defaults,
        sm.mapper.getRequiredAttributes(entityType)
      );
    });

    return context;
  };

  const processNerveResponse = (document: XMLDocument, context: ContextProps) => {
    const sm = writer.schemaManager;

    const entities: any[] = [];
    const tagsContext: Itags = {};

    Object.entries(context.tags).forEach(([type, entry]) => {
      if (!entry.name) return;

      tagsContext[entry.name] = {
        lemma: entry.lemmaAttribute,
        uri: entry.linkAttribute,
        //@ts-ignore
        type: NerveToCWRCMappings[type],
      };
    });

    const getOffsetFromParent = (parent: HTMLElement | null, target: HTMLElement) => {
      if (!parent) return 0;

      let offset = 0;
      const walker = parent.ownerDocument.createTreeWalker(parent, NodeFilter.SHOW_ALL);

      while (walker.nextNode()) {
        const currNode = walker.currentNode;
        if (currNode === target) {
          break;
        } else if (currNode.nodeType === Node.TEXT_NODE) {
          //@ts-ignore
          offset += currNode.length;
        }
      }
      return offset;
    };

    const respAttr = sm.mapper.getResponsibilityAttributeName();

    $(document.documentElement)
      .find(`[${respAttr}=NERVE]`)
      .each((index, el) => {
        const tag = el.nodeName;
        const mapping = sm.mapper.getReverseMapping(el, true);

        if (mapping.type === undefined) {
          log.warn('nerve: unrecognized entity type for', tag);
        } else {
          if (mapping.lemma !== undefined || mapping.uri !== undefined) {
            const xpath = writer.utilities.getElementXPath(el.parentElement);
            const offset = getOffsetFromParent(el.parentElement, el);
            mapping.text = el.textContent;
            mapping.xpath = xpath;
            mapping.textOffset = offset;
            mapping.textLength = el.textContent?.length ?? 0;

            entities.push(mapping);
          }
        }
      });

    return entities;
  };

  const getNerveEntities = (onlyEdited = false) => {
    let entities = writer.entitiesManager.getEntitiesArray(getCurrentSorting());

    entities = entities.filter((entry: any) => {
      return (
        entry.getCustomValue('nerve') === 'true' &&
        ((onlyEdited && entry.getCustomValue('edited') === 'true') || !onlyEdited)
      );
    });
    return entities;
  };

  const renderEntitiesList = () => {
    $parent.find('.moduleContent ul').empty();

    let entityHtml = '';

    getNerveEntities().forEach((ent: any, index: number) => {
      if (isEntityMerged(ent.getId()) === false) {
        entityHtml += getEntityView(ent, isMerge);
      }
    });

    for (const key in mergedEntities) {
      entityHtml += getMergedEntityView(key, isMerge);
    }

    $parent.find('ul.entitiesList').html(entityHtml);

    $parent
      .find('ul.entitiesList > li > div')
      .on('click', function (event) {
        $(this).parent().toggleClass('expanded');
        const id = $(this).parent().attr('data-id');
        writer.entitiesManager.highlightEntity(id, null, true);
      })
      .find('.actions > span')
      .on('mouseenter', function () {
        $(this).removeClass('ui-state-default');
        $(this).addClass('ui-state-active');
      })
      .on('mouseleave', function () {
        $(this).addClass('ui-state-default');
        $(this).removeClass('ui-state-active');
      })
      .on('click', function (event) {
        event.stopPropagation();

        const action = $(this).data('action');
        const id = $(this).parents('li').data('id');
        const merged = $(this).parents('li').hasClass('merged');

        switch (action) {
          case 'accept':
            if (merged) {
              acceptMerged(id);
              writer.entitiesList.update();
            } else {
              acceptEntity(id);
              writer.entitiesList.update();
            }
            break;

          case 'acceptmatching':
            acceptMatching(id);
            break;

          case 'reject':
            merged ? rejectMerged(id) : rejectEntity(id);
            break;

          case 'edit':
            merged ? mergeEntities(id) : editEntity(id);
            break;

          case 'unmerge':
            unmergeEntities(id);
            break;
        }
      });

    // merged entity navigation
    $parent
      .find('ul.entitiesList > li .nav > span')
      .on('mouseenter', function () {
        $(this).removeClass('ui-state-default');
        $(this).addClass('ui-state-active');
      })
      .on('mouseleave', function () {
        $(this).addClass('ui-state-default');
        $(this).removeClass('ui-state-active');
      })
      .on('click', function (event) {
        event.stopPropagation();

        const action = $(this).data('action');
        //@ts-ignore
        const entry = mergedEntities[$(this).parents('li').data('id')];
        const currId = writer.entitiesManager.getCurrentEntity();
        let entityIndex = 0;

        if (action === 'previous') {
          if (currId === null) {
            entityIndex = entry.entityIds.length - 1;
          } else {
            const idIndex = entry.entityIds.indexOf(currId);
            entityIndex = idIndex - 1;
            if (entityIndex < 0) entityIndex = entry.entityIds.length - 1;
          }
        } else {
          if (currId === null) {
            entityIndex = 0;
          } else {
            const idIndex = entry.entityIds.indexOf(currId);
            entityIndex = idIndex + 1;
            if (entityIndex > entry.entityIds.length - 1) entityIndex = 0;
          }
        }
        const id = entry.entityIds[entityIndex];
        writer.entitiesManager.highlightEntity(id, null, true);
      });

    if (isMerge) {
      $parent.find('ul.entitiesList > li > input').on('click', () => {
        const checked = getCheckedEntities();
        if (checked.length === 0) {
          filterEntityView('all');
        } else {
          const type = checked.first().data('type');
          filterEntityView(`type_${type}`);
        }
      });
    }

    //@ts-ignore
    $parent.find('ul.entitiesList .actions').tooltip({
      show: false,
      hide: false,
      classes: { 'ui-tooltip': 'cwrc-tooltip' },
    });
  };

  const getEntityView = function (entity: any, merge: boolean) {
    const id: string = entity.getId();
    const type: string = entity.getType();
    const content: string = entity.getContent();
    const hasMatching = getMatchesForEntity(entity.getId()).length > 0;

    const acceptAllMatchesComponent =
      hasMatching === true
        ? `
          <span data-action="acceptmatching" class="ui-state-default" title="Accept All Matching">
            <span class="ui-icon ui-icon-circle-check"/>
          </span>
        `
        : '';

    const actionsComponent =
      merge === true
        ? ''
        : `
          <span data-action="edit" class="ui-state-default" title="Edit">
            <span class="ui-icon ui-icon-pencil"/>
          </span>
          <span data-action="accept" class="ui-state-default" title="Accept">
            <span class="ui-icon ui-icon-check"/>
          </span>
          ${acceptAllMatchesComponent}
          <span data-action="reject" class="ui-state-default" title="Reject">
            <span class="ui-icon ui-icon-close"/>
          </span>
        `;

    const html = `
      <li class="${entity.getType()}" data-type="${type}" data-id="${id}">
        ${merge === true ? '<input type="checkbox" />' : ''}
        <div>
          <div class="header">
            <i class="fas fa-${iconsMap.get(type)} icon"></i>
            <span class="entityTitle">
              ${entity.getCustomValue('edited') === 'true' ? '&#8226; ' : ''}${content}
            </span>
            <div class="actions">
              ${actionsComponent}
            </div>
          </div>
          <div class="info">${getEntityViewInfo(entity)}</div>
        </div>
      </li>
    `;
    return html;
  };

  const getMergedEntityView = function (id: string, merge: boolean) {
    //@ts-ignore
    const entry = mergedEntities[id];

    const mergeOptionsComponents =
      merge !== true
        ? `
          <div class="actions">
            <div class="nav">
              <span data-action="previous" class="ui-state-default" title="Previous Entity">
                <span class="ui-icon ui-icon-circle-arrow-w"></span>
              </span>
              <span data-action="next" class="ui-state-default" title="Next Entity">
                <span class="ui-icon ui-icon-circle-arrow-e"></span>
              </span>
            </div>
            <span data-action="unmerge" class="ui-state-default" title="Unmerge">
              <span class="ui-icon ui-icon-scissors"></span>
            </span>
            <span data-action="edit" class="ui-state-default" title="Edit">
              <span class="ui-icon ui-icon-pencil"></span>
            </span>
            <span data-action="accept" class="ui-state-default" title="Accept">
              <span class="ui-icon ui-icon-check"></span>
            </span>
            <span data-action="reject" class="ui-state-default" title="Reject">
              <span class="ui-icon ui-icon-close"></span>
            </span>
          </div>
        `
        : '';

    const html = `
    <li class="${entry.type} merged" data-type="${entry.type}" data-id="${id}">
      ${merge === true ? '<input type="checkbox" />' : ''}
      <div>
        <div class="header">
          <i class="fas fa-${iconsMap.get(entry.type)} icon"></i>
          <i class="fas fa-${iconsMap.get(entry.type)} icon"></i>
          <span class="entityTitle">&#8226; ${entry.lemma}</span>
          <div class="actions">
            ${mergeOptionsComponents}
          </div>
        </div>
        <div class="info">
          <ul>
            <li>
              <strong>URI</strong>:{' '}
              <a href="${entry.uri}" target="_blank" rel="noopener">
                ${entry.uri}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </li>
  `;

    return html;
  };

  const getEntityViewInfo = function (entity: any) {
    const lemma = entity.getLemma();
    const uri = entity.getURI();

    let html = '<ul>';

    if (lemma !== undefined) {
      html += `<li><strong>Standard</strong>: ${lemma}</li>`;
    }

    if (uri !== undefined) {
      html += `<li>
          <strong>URI</strong>: <a href="${uri}" target="_blank" rel="noopener">${uri}</a>
        </li>`;
    }
    html += '</ul>';
    return html;
  };

  const updateEntityView = ({ entity, expand = true }: { entity: any; expand?: boolean }) => {
    const view = $parent.find(`ul.entitiesList > li[data-id=${entity.getId()}]`);
    view.data('type', entity.getType()).attr('data-type', entity.getType());

    const alreadyExpanded = view.hasClass('expanded');
    view.removeClass();
    view.addClass(entity.getType());
    if (alreadyExpanded || expand === true) view.addClass('expanded');

    const title =
      (entity.getCustomValue('edited') !== 'true' ? '&#8226; ' : '') + entity.getContent();
    view.find('.entityTitle').html(title);
    view.find('.info').html(getEntityViewInfo(entity));
  };

  /**
   * Filter the view based on the specified filter.
   * Can be either a type or status filter. If not specified, assumed to be type filter.
   * If specified, format is: filterType_filterValue. For example: status_edited, type_place
   * @param {String} filter
   */
  const filterEntityView = (filter: string | number | string[] | undefined) => {
    if (filter === undefined) return;
    if (Array.isArray(filter)) filter = filter[0];
    if (typeof filter === 'number') filter = filter.toString();

    let filterType = 'type';

    if (filter?.indexOf('_') !== -1) {
      const details = filter?.split('_');
      if (details) {
        filterType = details[0] ?? '';
        filter = details[1];
      }
    }

    $parent.find('ul.entitiesList > li').each(function (index, el) {
      //@ts-ignore
      const $ent = $(this);

      if (filter === 'all') {
        $ent.show();
        return;
      }

      if (filterType === 'type' && typeof filter === 'string') {
        $ent.hasClass(filter) ? $ent.show() : $ent.hide();
        return;
      }

      const entry = writer.entitiesManager.getEntity($ent.data('id'));
      const isEdited =
        (entry && entry.getCustomValue('edited') === 'true') || $ent.hasClass('merged');

      (filter === 'edited' && isEdited) || (filter === 'notedited' && !isEdited)
        ? $ent.show()
        : $ent.hide();
    });
  };

  const getFilterValue = () => $parent.find('select[name="filter"]').val();

  const setFilterValue = (value: 'all' | 'status_edited') => {
    //@ts-ignore
    $parent.find('select[name="filter"]').val(value).selectmenu('refresh');
  };

  const getCurrentSorting = () => $parent.find('select[name="sorting"]').val();

  const getEntryForEntityId = (entityId: string) => writer.entitiesManager.getEntity(entityId);

  const removeEntityFromView = (id: string) => {
    $parent.find(`ul.entitiesList li[data-id=${id}]`).remove();
  };

  const selectRangeForEntity = (entry: any) => {
    const parent = writer.utilities.evaluateXPath(writer.editor.getBody(), entry.xpath);
    if (parent === null) {
      log.warn('nerve: could not get parent for "', entry.lemma, '" at:', entry.xpath);
      return null;
    }

    let totalOffset = 0;
    let currNode;
    const walker = writer.editor.getDoc().createTreeWalker(parent, NodeFilter.SHOW_ALL);

    while (walker.nextNode()) {
      currNode = walker.currentNode;
      if (currNode.nodeType === Node.TEXT_NODE) {
        if (totalOffset + currNode.length >= entry.textOffset) {
          break;
        }

        if (currNode.length === 1 && currNode.data === '\uFEFF') {
          // skip empty elements
        } else {
          totalOffset += currNode.length;
        }
      }
    }

    const startOffset = entry.textOffset - totalOffset;
    const endOffset = startOffset + entry.textLength;

    const range = writer.editor.selection.getRng(true);

    try {
      range.setStart(currNode, startOffset);
      range.setEnd(currNode, endOffset);
      return range;
    } catch (event) {
      range.collapse();
      log.warn('nerve: could not select range for', entry);
      return null;
    }
  };

  /**
   * Get the tag names used by the named entities
   */
  const getNamedEntityTags = () => {
    const namedEntities = ['person', 'place', 'org'];
    const namedEntityTags = namedEntities.map((type) => {
      return writer.schemaManager.mapper.getParentTag(type);
    });
    return namedEntityTags;
  };

  const addEntityFromNerve = (entry: any) => {
    const range = selectRangeForEntity(entry);

    if (range !== null) {
      const parentEl = range.commonAncestorContainer.parentElement;

      if (range.startOffset === 0) {
        const namedEntityTags = getNamedEntityTags();
        if (
          parentEl.getAttribute('_entity') === 'true' ||
          namedEntityTags.indexOf(parentEl.getAttribute('_tag')) !== -1
        ) {
          log.info('nerve: entity already exists for', entry);
          range.collapse();
          return false;
        }
      }

      const entityConfig = {
        type: entry.type,
        content: entry.text,
        attributes: { _candidate: 'true' },
        customValues: {
          nerve: 'true', // TODO need to differentiate between entities tagged by nerve and those linked by nerve
        },
      };

      //@ts-ignore
      if (entry.lemma !== '') entityConfig.lemma = entry.lemma;

      //@ts-ignore
      if (entry.uri !== '') entityConfig.uri = entry.uri;

      Object.assign(entityConfig.attributes, entry.attributes);

      const entity = writer.entitiesManager.addEntity(entityConfig, range);

      $(`#${entity.id}`, writer.editor.getBody()).attr('_candidate', 'true'); // have to manually add this since addEntityTag won't (since it's reserved)

      range.collapse();
      return true;
    }
    return false;
  };

  const acceptEntity = (entityId: string, removeFromView = true) => {
    const entity = writer.entitiesManager.getEntity(entityId);
    const tag = $(`#${entityId}`, writer.editor.getBody())[0];

    const respAttr: string = writer.schemaManager.mapper.getResponsibilityAttributeName();
    writer.tagger.removeAttributeFromTag(tag, respAttr);
    writer.tagger.removeAttributeFromTag(tag, 'xml:id');

    const taggedByNerve = entity.getCustomValue('nerve') !== undefined;
    const uri: string | undefined = entity.getURI();

    if (taggedByNerve && uri === undefined) {
      writer.tagger.removeEntity(entityId);
    } else {
      entity.removeCustomValue('nerve');
      entity.removeCustomValue('edited');
      entity.removeAttribute(respAttr);
      entity.removeAttribute('_candidate');
      entity.removeAttribute('xml:id');
      writer.tagger.removeAttributeFromTag(tag, '_candidate');
    }

    if (removeFromView) removeEntityFromView(entityId);
  };

  const acceptMatching = (entityId: string) => {
    // get matches before accepting initial entity because that will remove it from the nerve entities
    const matches = getMatchesForEntity(entityId);

    acceptEntity(entityId);
    matches.forEach((entId) => acceptEntity(entId));

    writer.entitiesList.update();
  };

  const getMatchesForEntity = (entityId: string) => {
    const matches: any[] = [];
    const match = writer.entitiesManager.getEntity(entityId);

    getNerveEntities().forEach((ent: any) => {
      if (
        ent.getId() !== match.getId() &&
        ent.getContent() === match.getContent() &&
        ent.getLemma() === match.getLemma() &&
        ent.getURI() == match.getURI()
      ) {
        matches.push(ent.getId());
      }
    });
    return matches;
  };

  const acceptAll = () => {
    writer.event('massUpdateStarted').publish();

    const filter = getFilterValue();

    const li = writer.dialogManager.getDialog('loadingindicator');
    li?.setText?.('Accepting Entities');
    li?.show();

    Object.keys(mergedEntities).forEach((key) => {
      //@ts-ignore
      const entry = mergedEntities[key];
      if (filter === 'all' || filter === entry.type) {
        entry.entityIds.forEach((entId: string) => {
          writer.entitiesManager.setLemmaForEntity(entId, entry.lemma);
          writer.entitiesManager.setURIForEntity(entId, entry.uri);
        });
        //@ts-ignore
        delete mergedEntities[key];
      }
    });

    writer.utilities
      .processArray(getNerveEntities(), (ent: any) => {
        if (filter === 'all' || filter === ent.getType()) {
          acceptEntity(ent.getId(), false);
        }
      })
      .then(() => {
        setFilterValue('all');
        renderEntitiesList();
        writer.event('massUpdateCompleted').publish();
      })
      .always(() => li?.hide?.());
  };

  const rejectEntity = (entityId: string, removeFromView = true) => {
    const entry = writer.entitiesManager.getEntity(entityId);
    const taggedByNerve = entry.getCustomValue('nerve') !== undefined;

    if (taggedByNerve) {
      writer.tagger.removeStructureTag(entityId, false);
      /* TODO when we start using nerve for linking, we'll need to revisit taggedByNerve
      if (entry.getURI() === undefined || entry.getURI() === '') {
          // remove tag and entity if both added by nerve
          writer.tagger.removeStructureTag(entityId, false);
      } else {
          // if tag already existed and nerve is just linking, then only remove the entity (and related nerve attributes)
          let tag = $('#'+entityId, writer.editor.getBody())[0];
          const respAttr = writer.schemaManager.mapper.getResponsibilityAttributeName();
          writer.tagger.removeAttributeFromTag(tag, respAttr);
          writer.tagger.removeAttributeFromTag(tag, '_candidate');

          writer.tagger.removeEntity(entityId);
      }
      */
    } else {
      writer.tagger.removeEntity(entityId);
    }

    if (removeFromView) removeEntityFromView(entityId);
  };

  const rejectAll = (isDone?: boolean) => {
    writer.event('massUpdateStarted').publish();

    const filter = getFilterValue();

    const li = writer.dialogManager.getDialog('loadingindicator');
    li?.setText?.('Rejecting Entities');
    li?.show();

    Object.keys(mergedEntities).forEach((key) => {
      //@ts-ignore
      const entry = mergedEntities[key];
      if (filter === 'all' || filter === entry.type) {
        //@ts-ignore
        delete mergedEntities[key];
      }
    });

    writer.utilities
      .processArray(getNerveEntities(), (ent: any) => {
        if (isDone || filter === 'all' || filter === ent.getType()) {
          rejectEntity(ent.getId(), false);
        }
      })
      .then(() => {
        setFilterValue('all');
        renderEntitiesList();
        writer.event('massUpdateCompleted').publish();
      })
      .always(() => li.hide());
  };

  const editEntity = (entityId: string) => {
    if (editDialog === null) {
      //@ts-ignore
      editDialog = new NerveEditDialog(writer, $parent);
      editDialog.$el.dialog('option', 'modal', false); // TODO modal dialog interferes with typing in lookups input
      editDialog.$el.on('save', (event: any, dialog: any) => {
        const entity = writer.entitiesManager.getEntity(dialog.currentId);
        updateEntityView({ entity });
        filterEntityView(getFilterValue());
      });
    }
    editDialog.show({ entry: getEntryForEntityId(entityId) });
  };

  const setMergeMode = (val: boolean) => {
    isMerge = val;

    if (isMerge) {
      $parent.find('.mergeActions').show();
      $parent.find('button.mergeEntities').hide();
      $parent
        .find('select[name="filter"]')
        .val('all')
        //@ts-ignore
        .selectmenu('refresh')
        .selectmenu('option', 'disabled', true);
    } else {
      $parent.find('.mergeActions').hide();
      $parent.find('button.mergeEntities').show();
      //@ts-ignore
      $parent.find('select[name="filter"]').selectmenu('option', 'disabled', false);
    }

    renderEntitiesList();
  };

  const isEntityMerged = (entityId: string) => {
    for (const key in mergedEntities) {
      //@ts-ignore
      const entry = mergedEntities[key];
      if (entry.entityIds.indexOf(entityId) !== -1) {
        return true;
      }
    }
    return false;
  };

  const mergeEntities = (id?: string) => {
    if (mergeDialog === null) {
      //@ts-ignore
      mergeDialog = new MergeDialog(writer, $parent);
      mergeDialog.$el.on(
        'merge',
        (event: any, entities: any[], mergeEntry: any, lemma: string, uri: string) => {
          if (mergeEntry != null) {
            mergeEntry.lemma = lemma;
            mergeEntry.uri = uri;

            if (isMerge) {
              // new entities have been added to the merge
              mergeEntry.entityIds = entities.map((ent) => ent.getId());
              setMergeMode(false);
            } else {
              // we just edited the merged entry
              renderEntitiesList();
            }
          } else {
            const ids = entities.map((ent) => ent.getId());
            const mId = writer.getUniqueId('merged_');

            //@ts-ignore
            mergedEntities[mId] = {
              entityIds: ids,
              type: entities[0].getType(),
              lemma: lemma,
              uri: uri,
            };
            setMergeMode(false);
          }
        }
      );
      mergeDialog.$el.on('cancel', function () {});
    }

    let entities = [];
    let entry;

    if (id !== undefined) {
      //@ts-ignore
      entry = mergedEntities[id];
      entities = entry.entityIds.map((entId: string) => writer.entitiesManager.getEntity(entId));
    } else {
      getCheckedEntities().each((index, el) => {
        const entityId = $(el).data('id');
        const entity = writer.entitiesManager.getEntity(entityId);

        if (entity === undefined) {
          // merged entity
          //@ts-ignore
          entry = mergedEntities[entityId];
          if (entry) {
            entry.entityIds.forEach((entId: string) => {
              entities.push(writer.entitiesManager.getEntity(entId));
            });
          }
        } else {
          entities.push(entity);
        }
      });
    }

    if (entities.length > 1) {
      mergeDialog.show();
      mergeDialog.populate(entities, entry);
      return;
    }

    writer.dialogManager.show('message', {
      title: 'Warning',
      msg: 'You must select at least 2 entities to merge.',
      type: 'info',
    });
  };

  const unmergeEntities = (mergeId: string) => {
    //@ts-ignore
    delete mergedEntities[mergeId];
    renderEntitiesList();
  };

  const acceptMerged = (mergeId: string) => {
    //@ts-ignore
    const entry = mergedEntities[mergeId];

    entry.entityIds.forEach((entId: string) => {
      writer.entitiesManager.setLemmaForEntity(entId, entry.lemma);
      writer.entitiesManager.setURIForEntity(entId, entry.uri);
      acceptEntity(entId);
    });

    //@ts-ignore
    delete mergedEntities[mergeId];
    removeEntityFromView(mergeId);
  };

  const rejectMerged = (mergeId: string) => {
    //@ts-ignore
    const entry = mergedEntities[mergeId];
    entry.entityIds.forEach((entId: string) => rejectEntity(entId));

    //@ts-ignore
    delete mergedEntities[mergeId];
    removeEntityFromView(mergeId);
  };

  const getCheckedEntities = () => {
    return $parent.find('ul.entitiesList > li > input:checked').parent('li');
  };

  const handleDone = () => {
    //@ts-ignore
    $parent.find('select').selectmenu('option', 'disabled', false);
    //@ts-ignore
    $parent.find('button.mergeEntities').button('disable');
    writer.editor.setMode('design');
    nrv.reset();

    writer.event('contentChanged').publish();
  };

  const nrv = {
    reset: () => {
      mergedEntities = {};
      $parent.find('.moduleContent ul').empty();
      $parent.find('.listActions').hide();
      $parent.find('.filters').hide();
      $parent.find('button.run').show();
      $parent.find('button.done').hide();
    },
    destroy: () => {
      $parent.empty();
      //@ts-ignore
      $parent.find('ul.entitiesList .actions').tooltip('destroy');
    },
  };

  return nrv;
}

export default Nerve;

const nerveResultsTestSampleLetter = {
  processingDate: '2021-12-06T23:44:55.807495',
  metadata: {},
  data: [
    {
      selections: [{ lemma: 'John', selection: { start: 220, end: 224 } }],
      classification: 'MISC',
      entity: 'John',
    },
    {
      selections: [{ lemma: 'Anglo - Norwegian Society', selection: { start: 979, end: 1006 } }],
      classification: 'MISC',
      entity: 'Anglo - Norwegian Society',
    },
    {
      selections: [{ lemma: 'Bergen', selection: { start: 1092, end: 1098 } }],
      classification: 'MISC',
      entity: 'Bergen',
    },
    {
      selections: [{ lemma: 'Sundays', selection: { start: 536, end: 552 } }],
      classification: 'MISC',
      entity: 'Sundays',
    },
    {
      selections: [{ lemma: 'Fri.', selection: { start: 1036, end: 1054 } }],
      classification: 'MISC',
      entity: 'Fri.',
    },
    {
      selections: [{ lemma: 'Brynjulf Bull', selection: { start: 362, end: 375 } }],
      classification: 'MISC',
      entity: 'Brynjulf Bull',
    },
    {
      selections: [{ lemma: 'Copenhagen', selection: { start: 290, end: 300 } }],
      classification: 'LOCATION',
      entity: 'Copenhagen',
    },
    {
      selections: [
        { lemma: 'Oslo', selection: { start: 338, end: 342 } },
        { lemma: 'Oslo', selection: { start: 739, end: 743 } },
        { lemma: 'Oslo', selection: { start: 1030, end: 1034 } },
      ],
      classification: 'MISC',
      entity: 'Oslo',
    },
    {
      selections: [{ lemma: 'Bergen', selection: { start: 117, end: 123 } }],
      classification: 'LOCATION',
      entity: 'Bergen',
    },
    {
      selections: [{ lemma: 'Sunday', selection: { start: 815, end: 821 } }],
      classification: 'MISC',
      entity: 'Sunday',
    },
  ],
};
