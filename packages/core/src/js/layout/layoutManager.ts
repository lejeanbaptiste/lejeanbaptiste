import fscreen from 'fscreen';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/tabs';
import 'layout-jquery3';
import { log } from './../../utilities';
import EntitiesList from './panels/entitiesList';
import ImageViewer from './panels/imageViewer';
import Nerve from './panels/nerve';
import Relations from './panels/relations';
import Selection from './panels/selection';
import StructureTree from './panels/structureTree';
import Validation from './panels/validation';
import Writer from '../Writer';

interface InitConfigProps {
  editorId: string;
  container: JQuery<HTMLElement>;
  modules?: any;
  name?: string;
}

type LayoutLocation = 'east' | 'west' | 'north' | 'south';

interface IModuleConfig {
  id: string;
  config?: any;
  title?: string;
}

// track modules which cannot appear in readonly mode
const WRITE_ONLY_MODULES = ['nerve'];

class LayoutManager {
  readonly writer: Writer;

  $containerid = '';
  $container: JQuery<HTMLElement> | null = null;
  $loadingMask: JQuery<HTMLElement> | null = null;
  $headerButtons: JQuery<HTMLElement> | null = null;

  $outerLayout: JQuery<HTMLElement> | null = null;
  $innerLayout: JQuery<HTMLElement> | null = null;

  name = 'Leaf-Writer';
  editorId = '';

  readonly PANEL_MIN_WIDTH = 320;

  modulesLayout = new Map<LayoutLocation, IModuleConfig | IModuleConfig[]>([
    ['west', [{ id: 'structure' }, { id: 'entities' }]],
    ['east', [{ id: 'selection' }]],
  ]);

  modules: any[] = [];

  constructor(writer: Writer, config?: InitConfigProps) {
    this.writer = writer;
  }

  init(config: InitConfigProps) {
    if (config.modules) {
      this.modulesLayout.clear();
      const regions = Object.entries(config.modules).forEach(([region, modules]) => {
        this.modulesLayout.set(region as LayoutLocation, modules as IModuleConfig[]);
      });
    }

    this.$containerid = this.writer.getUniqueId('cwrc_');

    this.$container = $(`<div id="${this.$containerid}" class="cwrc cwrcWrapper" />`).appendTo(
      config.container
    );

    if (config.name) this.name = config.name;
    this.editorId = config.editorId;

    const loadingMaskHtml = `
      <div
        class="cwrc cwrcLoadingMask"
        style="
          width: 100%;
          height: 100%;
          background-color: #DDD;
          position: absolute;
          z-index: 1000;
        "
      >
        <div>Loading ${this.name}</div>
      </div>
    `;
    this.$container.html(loadingMaskHtml);

    // filter modules
    this.modulesLayout.forEach((module) => {
      module = Array.isArray(module)
        ? module.filter((module) => this.isModuleAllowed(module))
        : this.isModuleAllowed(module)
        ? module
        : [];
    });

    let html = '';

    //WEST
    const West = this.modulesLayout.get('west');
    if (West) html += this.addPanel('west', West);

    //CENTER

    html += '<div class="cwrc ui-layout-center">';

    //NORTH - INSIDE CENTER
    const North = this.modulesLayout.get('north');
    if (North) html += this.addPanel('north', North);

    //CENTRAL
    html += `
      <div class="ui-layout-center ui-widget ui-widget-content">
        <textarea id="${this.editorId}" name="editor" class="tinymce"></textarea>
      </div>
    `;

    //SOUTH - INSIDE CENTER
    const South = this.modulesLayout.get('south');
    if (South) html += this.addPanel('south', South);

    html += '</div>';

    //EAST - INSIDE CENTER
    const East = this.modulesLayout.get('east');
    if (East) html += this.addPanel('east', East);

    this.$container.append(html);

    this.$loadingMask = this.$container.find('.cwrcLoadingMask').first();
    this.$headerButtons = this.$container.find('.headerButtons').first();

    if (this.writer.isReadOnly || this.writer.isAnnotator) {
      const $fullscreenButton = $('<div class="fullscreenLink out">Fullscreen</div>').appendTo(
        this.$headerButtons
      );

      $fullscreenButton.on('click', () => this.toggleFullScreen());
    }

    const outerLayoutConfig = {
      defaults: {
        enableCursorHotkey: false,
        maskIframesOnResize: true,
        closable: true,
        resizable: true,
        slidable: false,
        fxName: 'none',
      },
      north: {
        size: 35,
        spacing_open: 0,
        minSize: 35,
        maxSize: 60,
        closable: false,
        resizable: false,
      },
      south: {
        size: 15,
        minSize: 15,
        maxSize: 15,
        spacing_open: 0,
        closable: false,
        resizable: false,
      },
    };

    if (this.modulesLayout.get('west')) {
      //@ts-ignore
      outerLayoutConfig.west = {
        size: 'auto',
        minSize: this.PANEL_MIN_WIDTH,
      };
    }

    if (this.modulesLayout.get('east')) {
      //@ts-ignore
      outerLayoutConfig.east = {
        size: 'auto',
        minSize: this.PANEL_MIN_WIDTH,
        initClosed: true,
      };
    }

    //@ts-ignore
    this.$outerLayout = this.$container.layout(outerLayoutConfig);

    const innerLayoutConfig = {
      defaults: {
        enableCursorHotkey: false,
        maskIframesOnResize: true,
        closable: true,
        resizable: true,
        slidable: false,
        fxName: 'none',
      },
      center: {
        //@ts-ignore
        onresize_end: (region, pane, state, options) => {
          // // ! DEPRECATED resizeEditor might not be necessary anymore.
          // log.info(
          //   '%c"resizeEditor" DEPRECATED: might not be necessary anymore.',
          //   'color: gray;'
          // );
          // this.resizeEditor();
        },
      },
    };

    if (this.modulesLayout.get('south')) {
      //@ts-ignore
      innerLayoutConfig.south = {
        size: 250,
        resizable: true,
        initClosed: true,
        //@ts-ignore
        activate: (event: any, ui: any) => $.layout.callbacks.resizeTabLayout(event, ui),
      };
    }

    //@ts-ignore
    this.$innerLayout = this.$container.find('.ui-layout-center').first().layout(innerLayoutConfig);

    this.modulesLayout.forEach((moduleConfig, region) => {
      if (!Array.isArray(moduleConfig)) {
        const module = this.initModule(moduleConfig);
        if (module) this.modules.push(module);
        return;
      }

      const $region = this.$container?.find(
        `.ui-layout-${region}:not(.cwrcHeader):not(.cwrcFooter)`
      );

      if (!$region) return;

      moduleConfig.forEach((config) => {
        const module = this.initModule(config);
        if (module) this.modules.push(module);
      });

      //@ts-ignore
      $region.tabs({
        //@ts-ignore
        activate: (event: any, ui: any) => $.layout.callbacks.resizeTabLayout(event, ui),
        create: (event: any, ui: any) => {
          $region.parent().find('.ui-corner-all:not(button)').removeClass('ui-corner-all');
        },
      });
    });

    // ?show/hide entity buttons based on the presence of a custom schema
    // this.writer.event('documentLoaded').subscribe((success: boolean) => {
    // /  !success || this.writer.schemaManager.isSchemaCustom()
    //     ? this.doHandleEntityButtons(true)
    //     : this.doHandleEntityButtons();
    // });
  }

  // resizeEditor() {
  //   if (!this.writer.editor) return;

  //   const pane = $(this.writer.editor.getContainer().parentElement);
  //   const containerHeight = pane.height() ?? 0;

  //   const toolbars = pane[0].querySelectorAll('.mce-toolbar, .mce-statusbar, .mce-menubar');
  //   const toolbarsLength: Number = toolbars.length;

  //   let barsHeight = 0;

  //   for (const toolbar of toolbars) {
  //     if (!toolbar.classList.contains('mce-sidebar-toolbar')) {
  //       const barHeight = $(toolbar).height() ?? 0;
  //       barsHeight += barHeight;
  //     }
  //   }

  //   const newHeight = containerHeight - barsHeight - 8;
  //   this.writer.editor.theme.resizeTo('100%', newHeight);
  // };

  showModule(moduleId: string) {
    this.modulesLayout.forEach((modules, region) => {
      if (!Array.isArray(modules)) {
        if (modules.id === moduleId) this.showRegion(region);
        return;
      }

      modules.forEach((module, index) => {
        if (module.id === moduleId) this.showRegion(region, index);
      });
    });
  }

  hideModule(moduleId: string) {
    
    this.modulesLayout.forEach((modules, region) => {
      if (!Array.isArray(modules)) {
        if (modules.id === moduleId) this.hideRegion(region);
        return;
      }

      modules.forEach((module) => {
        if (module.id === moduleId) this.hideRegion(region);
      });
    });
  }

  showRegion(region: LayoutLocation, tabIndex?: number) {
    if (region === 'south') {
      //@ts-ignore
      this.$innerLayout.open('south');
      if (tabIndex) {
        //@ts-ignore
        this.$innerLayout.panes[region].tabs('option', 'active', tabIndex);
      }
      return;
    }

    if (region !== 'west' && region !== 'east') return;

    if (region === 'west') {
      //@ts-ignore
      this.$outerLayout.open('west');
    }

    if (region === 'east') {
      //@ts-ignore
      this.$outerLayout.open('east');
    }

    if (tabIndex) {
      //@ts-ignore
      this.$outerLayout.panes[region].tabs('option', 'active', tabIndex);
    }
  }

  hideRegion(region: LayoutLocation) {
    if (region === 'south') {
      //@ts-ignore
      this.$innerLayout.close('south');
      return;
    }

    if (region === 'west') {
      //@ts-ignore
      this.$outerLayout.close('west');
      return;
    }

    if (region === 'east') {
      //@ts-ignore
      this.$outerLayout.close('east');
      return;
    }
  }

  showToolbar() {
    $('.mce-toolbar-grp', this.writer.editor?.getContainer()).first().show();
  }

  hideToolbar() {
    $('.mce-toolbar-grp', this.writer.editor?.getContainer()).first().hide();
  }

  toggleFullScreen() {
    if (!fscreen.fullscreenEnabled) return;

    if (fscreen.fullscreenElement) {
      fscreen.exitFullscreen();
      return;
    }

    const container = this.getContainer();
    if (container) fscreen.requestFullscreen(container[0]);
  }

  isFullScreen() {
    return fscreen.fullscreenEnabled && fscreen.fullscreenElement ? true : false;
  }

  resizeAll() {
    //@ts-ignore
    this.$outerLayout?.resizeAll();
    //@ts-ignore
    this.$innerLayout?.resizeAll();
  }

  getContainer() {
    return this.$container;
  }

  getHeaderButtonsParent() {
    return this.$headerButtons;
  }

  destroy() {
    this.modules.forEach((module) => {
      module.destroy
        ? module.destroy()
        : log.warn(`LayoutManager: no destroy method for ${module}`);
    });

    //@ts-ignore
    this.$outerLayout?.destroy(true);
    this.$container?.remove();
  }

  private isModuleAllowed(module: IModuleConfig) {
    return (
      !this.writer.isReadOnly || (this.writer.isReadOnly && !WRITE_ONLY_MODULES.includes(module.id))
    );
  }

  private addPanel(panelRegion: string, panelConfig: IModuleConfig | IModuleConfig[]) {
    if (!panelConfig) return '';

    //single module
    if (!Array.isArray(panelConfig)) {
      // const module = Array.isArray(panelConfig) ? panelConfig[0] : panelConfig;
      return `
        <div
          id="${this.editorId}-${panelConfig.id}"
          class="cwrc ui-layout-${panelRegion}"
        />
      `;
    }

    //multiple modules
    return `
      <div class="cwrc tabs ui-layout-${panelRegion}">
        <ul>
          ${panelConfig.map(({ id, title }) => {
            if (!title) title = id.charAt(0).toUpperCase() + id.slice(1);
            return `<li><a href="#${this.editorId}-${id}">${title}</a></li>`;
          }).join('')}
        </ul>
        <div class="ui-layout-content">
          ${panelConfig.map(({ id }) => `<div id="${this.editorId}-${id}"/>`).join('')}
        </div>
      </div>
    `;
  }

  private initModule(module: IModuleConfig) {
    if (this.isModuleAllowed(module) === false) return null;

    const config = module.config || {};
    config.writer = this.writer;
    config.parentId = `${this.editorId}-${module.id}`;

    if (module.id === 'structure') return new StructureTree(config);
    if (module.id === 'entities') return new EntitiesList(config);
    if (module.id === 'relations') return new Relations(config);
    if (module.id === 'validation') return new Validation(config);
    if (module.id === 'selection') return new Selection(config);
    if (module.id === 'imageViewer') return new ImageViewer(config);

    // if (module.id === 'nerve') return new Nerve(config);

    return null;
  }
}

export default LayoutManager;
