import fscreen from 'fscreen';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/tabs';
import '../../lib/jquery/jquery.layout_and_plugins.js';
import { ISettingsModuleName } from '../../types/index.js';
import Writer from '../Writer';
import { log } from './../../utilities';
import EntitiesList from './panels/entitiesList';
import ImageViewer from './panels/imageViewer';
import Validation from './panels/validation';

interface InitConfigProps {
  editorId: string;
  container: JQuery<HTMLElement>;
  modules?: any;
  name?: string;
}

type LayoutLocation = 'east' | 'west' | 'north' | 'south';

interface ModuleConfig {
  id: ISettingsModuleName;
  config?: any;
  title?: string;
}

// track modules which cannot appear in readonly mode
const WRITE_ONLY_MODULES: ISettingsModuleName[] = ['markup', 'validation', 'code'];

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

  modulesLayout = new Map<LayoutLocation, ModuleConfig | ModuleConfig[]>([
    ['west', [{ id: 'markup' }, { id: 'entities' }]],
    ['east', [{ id: 'code' }]],
  ]);

  modules: any[] = [];

  constructor(writer: Writer) {
    this.writer = writer;
  }

  init(config: InitConfigProps) {
    if (config.modules) {
      this.modulesLayout.clear();
      Object.entries(config.modules).forEach(([region, modules]) => {
        this.modulesLayout.set(region as LayoutLocation, modules as ModuleConfig[]);
      });
    }

    this.$containerid = this.writer.getUniqueId('cwrc_');

    this.$container = $(`<div id="${this.$containerid}" class="cwrc cwrcWrapper" />`).appendTo(
      config.container,
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
      <div class="ui-layout-center ui-widget ui-widget-content" style="background-color: #f6f6f6">
        <div id="editor-toolbar" />
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
        onresize_end: () => this.resizeEditor(),
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
        `.ui-layout-${region}:not(.cwrcHeader):not(.cwrcFooter)`,
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
        create: () => {
          $region.parent().find('.ui-corner-all:not(button)').removeClass('ui-corner-all');
        },
      });
    });
  }

  resizeEditor() {
    if (!this.writer.editor) return;

    const toolbar = document.querySelector('#editor-toolbar');
    const tox = document.querySelector('.tox')!;
    if (!toolbar || !tox) return;

    const toolbarHeight = toolbar.getBoundingClientRect().height;

    tox.style.height = `calc(100% - ${toolbarHeight}px)`;
  }

  showModule(moduleId: ISettingsModuleName) {
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

    //@ts-ignore
    if (tabIndex >= 0 && this.$outerLayout.panes[region].tabs('instance')) {
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

  toggleFullScreen() {
    if (!fscreen.fullscreenEnabled) return fscreen.fullscreenEnabled;

    if (fscreen.fullscreenElement) {
      fscreen.exitFullscreen();
      return false;
    }

    const container = this.getContainer()?.parent();
    if (container?.[0]) fscreen.requestFullscreen(container[0]);

    return true;
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

  toggleReadonly(readonly: boolean) {
    this.showModule('toc');
    this.showModule('imageViewer');

    //Change tabs
    [...this.modulesLayout.entries()].forEach(([region, modules]) => {
      if (!Array.isArray(modules)) modules = [modules];

      modules.forEach(({ id, title }) => {
        const tab = document.querySelector(`.ui-layout-${region} > ul > li#${id}`);
        if (!tab) return;

        if (WRITE_ONLY_MODULES.includes(id as ISettingsModuleName)) {
          (tab as HTMLElement).style.display = readonly ? 'none' : '';
        }

        if (Array.isArray(title)) {
          const a = tab.querySelector('a');
          if (a) a.innerText = readonly ? title[1] : title[0];
        }
      });
    });
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

  private addPanel(panelRegion: LayoutLocation, panelConfig: ModuleConfig | ModuleConfig[]) {
    if (!panelConfig) return '';

    //single module
    if (!Array.isArray(panelConfig)) {
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
          ${panelConfig
            .map(
              ({ id, title }) =>
                `
                <li id=${id}>
                  <a href="#${this.editorId}-${id}">${title}</a>
                </li>
              `,
            )
            .join('\n')}
        </ul>
        <div class="ui-layout-content">
          ${panelConfig.map(({ id }) => `<div id="${this.editorId}-${id}"/>`).join('\n')}
        </div>
      </div>
    `;
  }

  private initModule(module: ModuleConfig) {
    const config = module.config || {};
    config.writer = this.writer;
    config.parentId = `${this.editorId}-${module.id}`;

    if (module.id === 'entities') return new EntitiesList(config);
    if (module.id === 'validation') return new Validation(config);
    if (module.id === 'imageViewer') return new ImageViewer(config);

    return null;
  }
}

export default LayoutManager;
