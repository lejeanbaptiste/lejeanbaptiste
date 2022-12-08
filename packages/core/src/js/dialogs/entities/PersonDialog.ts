import type { SchemaMappingType } from '../../../types';
import type { EntityLink } from '../../../dialogs/entityLookups/types';
import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';
import DialogForm from '../dialogForm/dialogForm';
import type { LWDialogConfigProps } from '../types';
import type { SchemaDialog } from './types';
import { getSourceNameFromUrl } from './util';

interface Role {
  code: string;
  title: string;
}

const marcRoles: Role[] = [
  { code: '', title: '(none)' },
  { code: 'abr', title: 'Abridger' },
  { code: 'acp', title: 'Art copyist' },
  { code: 'act', title: 'Actor' },
  { code: 'adi', title: 'Art director' },
  { code: 'adp', title: 'Adapter' },
  { code: 'aft', title: 'Author of afterword, colophon, etc.' },
  { code: 'anl', title: 'Analyst' },
  { code: 'anm', title: 'Animator' },
  { code: 'ann', title: 'Annotator' },
  { code: 'ant', title: 'Bibliographic antecedent' },
  { code: 'ape', title: 'Appellee' },
  { code: 'apl', title: 'Appellant' },
  { code: 'app', title: 'Applicant' },
  { code: 'aqt', title: 'Author in quotations or text abstracts' },
  { code: 'arc', title: 'Architect' },
  { code: 'ard', title: 'Artistic director' },
  { code: 'arr', title: 'Arranger' },
  { code: 'art', title: 'Artist' },
  { code: 'asg', title: 'Assignee' },
  { code: 'asn', title: 'Associated name' },
  { code: 'ato', title: 'Autographer' },
  { code: 'att', title: 'Attributed name' },
  { code: 'auc', title: 'Auctioneer' },
  { code: 'aud', title: 'Author of dialog' },
  { code: 'aui', title: 'Author of introduction, etc.' },
  { code: 'aus', title: 'Screenwriter' },
  { code: 'aut', title: 'Author' },
  { code: 'bdd', title: 'Binding designer' },
  { code: 'bjd', title: 'Bookjacket designer' },
  { code: 'bkd', title: 'Book designer' },
  { code: 'bkp', title: 'Book producer' },
  { code: 'blw', title: 'Blurb writer' },
  { code: 'bnd', title: 'Binder' },
  { code: 'bpd', title: 'Bookplate designer' },
  { code: 'brd', title: 'Broadcaster' },
  { code: 'brl', title: 'Braille embosser' },
  { code: 'bsl', title: 'Bookseller' },
  { code: 'cas', title: 'Caster' },
  { code: 'ccp', title: 'Conceptor' },
  { code: 'chr', title: 'Choreographer' },
  { code: 'cli', title: 'Client' },
  { code: 'cll', title: 'Calligrapher' },
  { code: 'clr', title: 'Colorist' },
  { code: 'clt', title: 'Collotyper' },
  { code: 'cmm', title: 'Commentator' },
  { code: 'cmp', title: 'Composer' },
  { code: 'cmt', title: 'Compositor' },
  { code: 'cnd', title: 'Conductor' },
  { code: 'cng', title: 'Cinematographer' },
  { code: 'cns', title: 'Censor' },
  { code: 'coe', title: 'Contestant-appellee' },
  { code: 'col', title: 'Collector' },
  { code: 'com', title: 'Compiler' },
  { code: 'con', title: 'Conservator' },
  { code: 'cor', title: 'Collection registrar' },
  { code: 'cos', title: 'Contestant' },
  { code: 'cot', title: 'Contestant-appellant' },
  { code: 'cou', title: 'Court governed' },
  { code: 'cov', title: 'Cover designer' },
  { code: 'cpc', title: 'Copyright claimant' },
  { code: 'cpe', title: 'Complainant-appellee' },
  { code: 'cph', title: 'Copyright holder' },
  { code: 'cpl', title: 'Complainant' },
  { code: 'cpt', title: 'Complainant-appellant' },
  { code: 'cre', title: 'Creator' },
  { code: 'crp', title: 'Correspondent' },
  { code: 'crr', title: 'Corrector' },
  { code: 'crt', title: 'Court reporter' },
  { code: 'csl', title: 'Consultant' },
  { code: 'csp', title: 'Consultant to a project' },
  { code: 'cst', title: 'Costume designer' },
  { code: 'ctb', title: 'Contributor' },
  { code: 'cte', title: 'Contestee-appellee' },
  { code: 'ctg', title: 'Cartographer' },
  { code: 'ctr', title: 'Contractor' },
  { code: 'cts', title: 'Contestee' },
  { code: 'ctt', title: 'Contestee-appellant' },
  { code: 'cur', title: 'Curator' },
  { code: 'cwt', title: 'Commentator for written text' },
  { code: 'dbp', title: 'Distribution place' },
  { code: 'dfd', title: 'Defendant' },
  { code: 'dfe', title: 'Defendant-appellee' },
  { code: 'dft', title: 'Defendant-appellant' },
  { code: 'dgg', title: 'Degree granting institution' },
  { code: 'dis', title: 'Dissertant' },
  { code: 'dln', title: 'Delineator' },
  { code: 'dnc', title: 'Dancer' },
  { code: 'dnr', title: 'Donor' },
  { code: 'dpc', title: 'Depicted' },
  { code: 'dpt', title: 'Depositor' },
  { code: 'drm', title: 'Draftsman' },
  { code: 'drt', title: 'Director' },
  { code: 'dsr', title: 'Designer' },
  { code: 'dst', title: 'Distributor' },
  { code: 'dtc', title: 'Data contributor' },
  { code: 'dte', title: 'Dedicatee' },
  { code: 'dtm', title: 'Data manager' },
  { code: 'dto', title: 'Dedicator' },
  { code: 'dub', title: 'Dubious author' },
  { code: 'edc', title: 'Editor of compilation' },
  { code: 'edm', title: 'Editor of moving image work' },
  { code: 'edt', title: 'Editor' },
  { code: 'egr', title: 'Engraver' },
  { code: 'elg', title: 'Electrician' },
  { code: 'elt', title: 'Electrotyper' },
  { code: 'eng', title: 'Engineer' },
  { code: 'enj', title: 'Enacting jurisdiction' },
  { code: 'etr', title: 'Etcher' },
  { code: 'evp', title: 'Event place' },
  { code: 'exp', title: 'Expert' },
  { code: 'fac', title: 'Facsimilist' },
  { code: 'fds', title: 'Film distributor' },
  { code: 'fld', title: 'Field director' },
  { code: 'flm', title: 'Film editor' },
  { code: 'fmd', title: 'Film director' },
  { code: 'fmk', title: 'Filmmaker' },
  { code: 'fmo', title: 'Former owner' },
  { code: 'fmp', title: 'Film producer' },
  { code: 'fnd', title: 'Funder' },
  { code: 'fpy', title: 'First party' },
  { code: 'frg', title: 'Forger' },
  { code: 'gis', title: 'Geographic information specialist' },
  { code: 'his', title: 'Host institution' },
  { code: 'hnr', title: 'Honoree' },
  { code: 'hst', title: 'Host' },
  { code: 'ill', title: 'Illustrator' },
  { code: 'ilu', title: 'Illuminator' },
  { code: 'ins', title: 'Inscriber' },
  { code: 'itr', title: 'Instrumentalist' },
  { code: 'ive', title: 'Interviewee' },
  { code: 'ivr', title: 'Interviewer' },
  { code: 'inv', title: 'Inventor' },
  { code: 'isb', title: 'Issuing body' },
  { code: 'jud', title: 'Judge' },
  { code: 'jug', title: 'Jurisdiction governed' },
  { code: 'lbr', title: 'Laboratory' },
  { code: 'lbt', title: 'Librettist' },
  { code: 'ldr', title: 'Laboratory director' },
  { code: 'led', title: 'Lead' },
  { code: 'lee', title: 'Libelee-appellee' },
  { code: 'lel', title: 'Libelee' },
  { code: 'len', title: 'Lender' },
  { code: 'let', title: 'Libelee-appellant' },
  { code: 'lgd', title: 'Lighting designer' },
  { code: 'lie', title: 'Libelant-appellee' },
  { code: 'lil', title: 'Libelant' },
  { code: 'lit', title: 'Libelant-appellant' },
  { code: 'lsa', title: 'Landscape architect' },
  { code: 'lse', title: 'Licensee' },
  { code: 'lso', title: 'Licensor' },
  { code: 'ltg', title: 'Lithographer' },
  { code: 'lyr', title: 'Lyricist' },
  { code: 'mcp', title: 'Music copyist' },
  { code: 'mdc', title: 'Metadata contact' },
  { code: 'mfp', title: 'Manufacture place' },
  { code: 'mfr', title: 'Manufacturer' },
  { code: 'mod', title: 'Moderator' },
  { code: 'mon', title: 'Monitor' },
  { code: 'mrb', title: 'Marbler' },
  { code: 'mrk', title: 'Markup editor' },
  { code: 'msd', title: 'Musical director' },
  { code: 'mte', title: 'Metal-engraver' },
  { code: 'mus', title: 'Musician' },
  { code: 'nrt', title: 'Narrator' },
  { code: 'opn', title: 'Opponent' },
  { code: 'org', title: 'Originator' },
  { code: 'orm', title: 'Organizer of meeting' },
  { code: 'osp', title: 'Onscreen presenter' },
  { code: 'oth', title: 'Other' },
  { code: 'own', title: 'Owner' },
  { code: 'pan', title: 'Panelist' },
  { code: 'pat', title: 'Patron' },
  { code: 'pbd', title: 'Publishing director' },
  { code: 'pbl', title: 'Publisher' },
  { code: 'pdr', title: 'Project director' },
  { code: 'pfr', title: 'Proofreader' },
  { code: 'pht', title: 'Photographer' },
  { code: 'plt', title: 'Platemaker' },
  { code: 'pma', title: 'Permitting agency' },
  { code: 'pmn', title: 'Production manager' },
  { code: 'pop', title: 'Printer of plates' },
  { code: 'ppm', title: 'Papermaker' },
  { code: 'ppt', title: 'Puppeteer' },
  { code: 'pra', title: 'Praeses' },
  { code: 'prc', title: 'Process contact' },
  { code: 'prd', title: 'Production personnel' },
  { code: 'pre', title: 'Presenter' },
  { code: 'prf', title: 'Performer' },
  { code: 'prg', title: 'Programmer' },
  { code: 'prm', title: 'Printmaker' },
  { code: 'prn', title: 'Production company' },
  { code: 'pro', title: 'Producer' },
  { code: 'prp', title: 'Production place' },
  { code: 'prs', title: 'Production designer' },
  { code: 'prt', title: 'Printer' },
  { code: 'prv', title: 'Provider' },
  { code: 'pta', title: 'Patent applicant' },
  { code: 'pte', title: 'Plaintiff-appellee' },
  { code: 'ptf', title: 'Plaintiff' },
  { code: 'pth', title: 'Patent holder' },
  { code: 'ptt', title: 'Plaintiff-appellant' },
  { code: 'pup', title: 'Publication place' },
  { code: 'rbr', title: 'Rubricator' },
  { code: 'rce', title: 'Recording engineer' },
  { code: 'rcd', title: 'Recordist' },
  { code: 'rcp', title: 'Addressee' },
  { code: 'rdd', title: 'Radio director' },
  { code: 'red', title: 'Redaktor' },
  { code: 'ren', title: 'Renderer' },
  { code: 'res', title: 'Researcher' },
  { code: 'rev', title: 'Reviewer' },
  { code: 'rpc', title: 'Radio producer' },
  { code: 'rps', title: 'Repository' },
  { code: 'rpt', title: 'Reporter' },
  { code: 'rpy', title: 'Responsible party' },
  { code: 'rse', title: 'Respondent-appellee' },
  { code: 'rsg', title: 'Restager' },
  { code: 'rsp', title: 'Respondent' },
  { code: 'rsr', title: 'Restorationist' },
  { code: 'rst', title: 'Respondent-appellant' },
  { code: 'rth', title: 'Research team head' },
  { code: 'rtm', title: 'Research team member' },
  { code: 'sad', title: 'Scientific advisor' },
  { code: 'sce', title: 'Scenarist' },
  { code: 'scl', title: 'Sculptor' },
  { code: 'scr', title: 'Scribe' },
  { code: 'sds', title: 'Sound designer' },
  { code: 'sec', title: 'Secretary' },
  { code: 'sgd', title: 'Stage director' },
  { code: 'sgn', title: 'Signer' },
  { code: 'sht', title: 'Supporting host' },
  { code: 'sll', title: 'Seller' },
  { code: 'sng', title: 'Singer' },
  { code: 'spk', title: 'Speaker' },
  { code: 'spn', title: 'Sponsor' },
  { code: 'spy', title: 'Second party' },
  { code: 'std', title: 'Set designer' },
  { code: 'stg', title: 'Setting' },
  { code: 'stl', title: 'Storyteller' },
  { code: 'stm', title: 'Stage manager' },
  { code: 'stn', title: 'Standards body' },
  { code: 'str', title: 'Stereotyper' },
  { code: 'srv', title: 'Surveyor' },
  { code: 'tcd', title: 'Technical director' },
  { code: 'tch', title: 'Teacher' },
  { code: 'ths', title: 'Thesis advisor' },
  { code: 'tld', title: 'Television director' },
  { code: 'tlp', title: 'Television producer' },
  { code: 'trc', title: 'Transcriber' },
  { code: 'trl', title: 'Translator' },
  { code: 'tyd', title: 'Type designer' },
  { code: 'tyg', title: 'Typographer' },
  { code: 'uvp', title: 'University place' },
  { code: 'vdg', title: 'Videographer' },
  { code: 'wac', title: 'Writer of added commentary' },
  { code: 'wal', title: 'Writer of added lyrics' },
  { code: 'wam', title: 'Writer of accompanying material' },
  { code: 'wat', title: 'Writer of added text' },
  { code: 'wdc', title: 'Woodcutter' },
  { code: 'wde', title: 'Wood engraver' },
  { code: 'wit', title: 'Witness' },
];

const personTypeOptions = ['real', 'fictional', 'both'];
const certaintyOptions = ['high', 'medium', 'low', 'Unknown'];

class PersonDialog implements SchemaDialog {
  readonly writer: Writer;
  readonly dialog: DialogForm;
  readonly mappingID: SchemaMappingType;

  entry?: Entity;
  selectedText?: string;
  type: EntityTypes = 'person';

  constructor({ writer, parentEl }: LWDialogConfigProps) {
    this.writer = writer;
    const mappingID = writer.schemaManager.mapper.currentMappingsId;
    if (!mappingID) throw Error('Schema Mappings not found');

    this.mappingID = mappingID;

    const idPrefix =
      this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
        ? 'noteForm_' //orlando and cwrcEntry
        : 'personForm_'; //tei & teiLite

    const id = writer.getUniqueId(idPrefix);

    const entityAttributesSection = `
      <div class="entityAttributes">
        ${this.selectedTextField(id)}
        ${this.tagAsField(id)}
        ${this.mappingID === 'tei' || this.mappingID === 'teiLite' ? this.certaintyField(id) : ''}
        ${this.mappingID === 'tei' ? this.personTypeField(id) : ''}
        ${this.mappingID === 'tei' || this.mappingID === 'teiLite' ? this.personRoleField(id) : ''}
      </div>
    `;

    const $el = $(
      `<div class="annotationDialog">
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
    `
    ).appendTo(parentEl);

    //@ts-ignore
    const $relinkButton = $(`#${id}_tagAs .relink-bt`, $el).button();
    $relinkButton.on('click', () => {
      parentEl.css('display', 'none');

      this.writer.overmindActions.ui.openEntityLookupsDialog({
        entry: this.entry,
        type: this.type,
        onClose: (response?: EntityLink) => {
          parentEl.css('display', 'block');

          if (!response) {
            this.updateTagAs();
            return;
          }

          const uri = response.uri ?? '';
          const lemma = response.name ?? '';
          this.updateLink(lemma, uri);
          this.updateTagAs(lemma, uri);
        },
      });
    });

    this.dialog = new DialogForm({ writer, $el, type: 'person', title: 'Tag Person' });
  }

  private updateLink(lemma: string, uri: string) {
    if (this.entry) {
      this.writer.entitiesManager.setURIForEntity(this.entry.getId(), uri);
      this.writer.entitiesManager.setLemmaForEntity(this.entry.getId(), lemma);
      this.entry = this.writer.entitiesManager.getEntity(this.entry.getId());
    }

    this.updateTagAs(lemma, uri);

    this.dialog.attributesWidget?.setAttribute('key', lemma);
    this.dialog.attributesWidget?.setAttribute('ref', uri);
  }

  private updateTagAs(lemma?: string, uri?: string) {
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

  private selectedTextField(id: string) {
    const fieldTitle = 'Selected Text';

    return `
      <div id="${id}_selectedText" class="attribute">
        <p class="fieldLabel">${fieldTitle}</p>
        <p class="selectedText">${this.selectedText}</p>
      </div>
    `;
  }

  private updateTextField(value: string) {
    const fontSize = value.length > 30 ? 1 : 1.2;
    $('.selectedText').css('font-size', `${fontSize}em`);
    $('.selectedText').text(value);
  }

  private tagAsField(id: string) {
    const fieldTitle = 'Tag as';

    const dataMapping =
      this.mappingID === 'orlando' || this.mappingID == 'cwrcEntry'
        ? 'STANDARD' //orlando and cwrcEntry
        : 'prop.lemma'; //tei & teiLite

    return `
      <div id="${id}_tagAs" class="attribute">
        <div style="display: flex; align-items: center; gap: 8px;">
          <p class="fieldLabel">${fieldTitle}</p>
          
          <div class="relink-bt" style="cursor: pointer; padding: 4px;">
            <i class="fas fa-edit" />
          </div>
        </div>

        <div style="display: flex; flex-direction: column;" >
          <span class="tagAs" data-type="label" data-mapping="${dataMapping}"></span>
          <span class="tagAsSource" style="color: #999; display: none;">source: 
            <a class="tagAsSourceLink" href="" target="_blank" rel="noopener noreferrer nofollow"></a>
          </span>
        </div>
      </div>
    `;
  }

  private certaintyField(id: string) {
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

  private personTypeField(id: string) {
    const fieldTitle = 'Person type';

    const html = `
      <div
        id="${id}_type"
        class="attribute"
        data-transform="controlgroup"
        data-type="radio"
        data-mapping="type"
      >
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>

        ${personTypeOptions
          .map((type) => {
            return `
              <input type="radio" id="${id}_${type}" name="${id}_type_certainty" value="${type}" />
              <label for="${id}_${type}" style="text-transform: capitalize;">${type}</label>
            `;
          })
          .join('\n')}
      </div>
    `;

    return html;
  }

  private personRoleField(id: string) {
    const fieldTitle = 'Role (optional)';

    const html = `
      <div id="${id}_role" class="attribute">
        <div>
          <p class="fieldLabel">${fieldTitle}</p>
        </div>
        <select data-type="select" data-mapping="role" style="width: 100%;">
          ${marcRoles
            .sort((a, b) => {
              const nameA = a.title.toUpperCase(); // ignore upper and lowercase
              const nameB = b.title.toUpperCase(); // ignore upper and lowercase
              if (nameA < nameB) return -1;
              if (nameA > nameB) return 1;
              return 0;
            })
            .map((role) => `<option value="${role.code}">${role.title}</option>`)
            .join('\n')}
        </select>
      </div>
    `;

    return html;
  }

  show(config: { [x: string]: any; entry: Entity; query: string }) {
    this.entry = config.entry ? config.entry : undefined;
    this.selectedText = config.entry ? config.entry.content : config.query;

    this.updateTextField(this.selectedText ?? '');

    if (config.name && config.uri) this.updateTagAs(config.name, config.uri);
    if (!config.uri) this.updateTagAs();

    this.dialog.show(config);
  }

  destroy() {
    this.dialog.destroy();
  }
}

export default PersonDialog;
