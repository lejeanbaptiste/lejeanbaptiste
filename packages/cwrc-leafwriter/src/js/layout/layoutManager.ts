import fscreen from 'fscreen';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/tabs';
import '../../lib/jquery/jquery.layout_and_plugins.js';
import { ISettingsModuleName } from '../../types/index.js';
import Writer from '../Writer';
import { log } from './../../utilities';
import { describePanelNode, panelTrace } from '../../utilities/panelTrace';
import EntitiesList from './panels/entitiesList';
import ImageViewer from './panels/imageViewer';
import Validation from './panels/validation';

type DesktopLeftPanelTab = 'explorer' | 'find' | 'xpath' | 'toc' | 'markup' | 'entities';
type DesktopRightPanelTab =
  | 'fileMetadata'
  | 'attributes'
  | 'imageViewer'
  | 'validation'
  | 'translation';

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

  name = 'LEAF-Writer';
  editorId = '';
  editorViewMode: 'visual' | 'source' = 'visual';

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
      <div class="ui-layout-center ui-widget ui-widget-content" style="background-color: #f6f6f6; display: flex; flex-direction: column; min-height: 0; height: 100%;">
        <div id="editor-toolbar" />
        <div id="editor-location-bar" />
        <div id="source-editor-pane" style="display: none; flex: 1; min-height: 0; overflow: hidden; width: 100%;" />
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
        // The east resizer is hidden via CSS; without zero spacing the layout
        // still reserves a blank strip along the editor's right edge.
        spacing_open: 0,
        spacing_closed: 0,
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
        onresize_end: () => {
          if (this.editorViewMode === 'source') {
            this.resizeSourceEditor();
          } else {
            this.resizeEditor();
          }
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
          if (region === 'east') {
            panelTrace('layoutManager: east tabs created, dispatching lw:east-tabs-ready', {
              editorId: this.editorId,
              imageViewerNode: describePanelNode(
                document.getElementById(`${this.editorId}-imageViewer`),
              ),
              validationNode: describePanelNode(
                document.getElementById(`${this.editorId}-validation`),
              ),
            });
            window.dispatchEvent(
              new CustomEvent('lw:east-tabs-ready', { detail: { editorId: this.editorId } }),
            );
          }
        },
      });
    });
  }

  getEditorChromeHeight() {
    const toolbar = document.querySelector('#editor-toolbar') as HTMLElement | null;
    const locationBar = document.querySelector('#editor-location-bar') as HTMLElement | null;

    const toolbarHeight =
      toolbar && toolbar.style.display !== 'none' ? toolbar.getBoundingClientRect().height : 0;
    const locationBarHeight = locationBar?.getBoundingClientRect().height ?? 0;

    return toolbarHeight + locationBarHeight;
  }

  resizeEditorChrome() {
    if (this.editorViewMode === 'source') {
      this.resizeSourceEditor();
      return;
    }
    this.resizeEditor();
  }

  resizeEditor() {
    if (!this.writer.editor) return;

    const tox: HTMLElement | null = document.querySelector('.tox');
    if (!tox) return;

    const chromeHeight = this.getEditorChromeHeight();
    tox.style.height = `calc(100% - ${chromeHeight}px)`;
  }

  resizeSourceEditor() {
    const sourcePane = document.querySelector('#source-editor-pane') as HTMLElement | null;
    if (!sourcePane || sourcePane.style.display === 'none') return;

    const layoutPane = sourcePane.closest('.ui-layout-pane-center') as HTMLElement | null;
    const centralColumn = sourcePane.parentElement as HTMLElement | null;

    if (centralColumn) {
      centralColumn.style.height = '100%';
    }

    const paneHeight = layoutPane?.clientHeight ?? centralColumn?.clientHeight ?? 0;
    const chromeAbove = this.getEditorChromeHeight();

    if (paneHeight > 0) {
      sourcePane.style.height = `${Math.max(0, paneHeight - chromeAbove)}px`;
    }

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }

  setEditorViewMode(mode: 'visual' | 'source') {
    this.editorViewMode = mode;
    const toolbar = document.querySelector('#editor-toolbar') as HTMLElement | null;
    const sourcePane = document.querySelector('#source-editor-pane') as HTMLElement | null;
    const tox = document.querySelector('.tox') as HTMLElement | null;
    const textarea = document.querySelector(`#${this.editorId}`) as HTMLElement | null;

    if (mode === 'source') {
      if (toolbar) toolbar.style.display = 'none';
      if (tox) tox.style.display = 'none';
      if (textarea) textarea.style.display = 'none';
      if (sourcePane) sourcePane.style.display = 'flex';
      setTimeout(() => this.resizeSourceEditor(), 0);
      setTimeout(() => this.resizeSourceEditor(), 50);
      return;
    }

    if (toolbar) toolbar.style.display = '';
    if (tox) tox.style.display = '';
    // TinyMCE keeps the raw textarea hidden; never restore display or it appears as a stray resizable box.
    if (textarea) textarea.style.display = 'none';
    if (sourcePane) {
      sourcePane.style.display = 'none';
      sourcePane.style.height = '';
    }
    this.resizeEditor();
  }

  showModule(moduleId: ISettingsModuleName) {
    const westModules: DesktopLeftPanelTab[] = ['toc', 'markup', 'entities'];
    if (!this.modulesLayout.has('west') && westModules.includes(moduleId as DesktopLeftPanelTab)) {
      window.__desktopLeftPanel?.showTab(moduleId as DesktopLeftPanelTab);
      window.__desktopLeftPanel?.expand();
      return;
    }

    const rightPanelModules: ISettingsModuleName[] = [
      'fileMetadata',
      'attributes',
      'imageViewer',
      'validation',
      'translation',
    ];

    if (window.__desktopRightPanel) {
      const eastConfig = this.modulesLayout.get('east');
      const eastList = eastConfig ? (Array.isArray(eastConfig) ? eastConfig : [eastConfig]) : [];
      if (eastList.some((m) => m.id === moduleId)) {
        window.__desktopRightPanel.showTab(moduleId as DesktopRightPanelTab);
        window.__desktopRightPanel.expand();
        return;
      }
    }

    if (rightPanelModules.includes(moduleId)) {
      window.__desktopRightPanelPendingTab = moduleId as DesktopRightPanelTab;
      if (window.__desktopValidatorInstrumentation) {
        window.__desktopValidatorInstrumentation.validationPanelRequested = moduleId === 'validation';
      }
    }

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
      const moduleList = Array.isArray(modules) ? modules : [modules];
      if (!moduleList.some((module) => module.id === moduleId)) return;

      // Only affect layout when this module's tab is active. Otherwise a background
      // module (e.g. imageViewer with no page breaks) would collapse the whole east pane.
      if (!this.isModuleTabActive(region, moduleId)) return;

      this.switchAwayFromModuleTab(region, moduleId);
    });
  }

  private isModuleTabActive(region: LayoutLocation, moduleId: string): boolean {
    if (region !== 'east' && region !== 'west') return true;

    //@ts-ignore
    const $pane = this.$outerLayout?.panes?.[region];
    if (!$pane?.length) return false;

    //@ts-ignore
    return $pane.find(`> ul > li#${moduleId}`).hasClass('ui-tabs-active');
  }

  private switchAwayFromModuleTab(region: LayoutLocation, moduleId: string) {
    if (region !== 'east' && region !== 'west') {
      this.hideRegion(region);
      return;
    }

    //@ts-ignore
    const $pane = this.$outerLayout?.panes?.[region];
    if (!$pane?.length) return;

    //@ts-ignore
    const $alternate = $pane.find('> ul > li').filter(function (this: HTMLElement) {
      return this.style.display !== 'none' && this.id !== moduleId;
    });

    if ($alternate.length > 0) {
      this.showRegion(region, $alternate.first().index());
      return;
    }

    this.hideRegion(region);
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

  applyRawXmlPanelVisibility(show: boolean) {
    const tab = document.querySelector('.ui-layout-east > ul > li#code') as HTMLElement | null;
    if (tab) tab.style.display = show ? '' : 'none';

    if (show || !this.$outerLayout) return;

    //@ts-ignore
    const $east = this.$outerLayout.panes?.east;
    if (!$east) return;

    //@ts-ignore
    const $codeTab = $east.find('> ul > li#code');
    if (!$codeTab.hasClass('ui-tabs-active')) return;

    //@ts-ignore
    const $visibleTabs = $east.find('> ul > li').filter(function (this: HTMLElement) {
      return this.style.display !== 'none';
    });

    if ($visibleTabs.length > 0) {
      //@ts-ignore
      $east.tabs('option', 'active', $visibleTabs.first().index());
      return;
    }

    this.hideRegion('east');
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
    if (container?.[0]) fscreen.requestFullscreen($(document.body)[0]); // Use document body as element to start the full screen view from as otherwise some dialogs would not show up

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

        if (WRITE_ONLY_MODULES.includes(id)) {
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
    const iconTabsClass =
      panelRegion === 'east' ? ' cwrc-east-icon-tabs' : '';
    const panelDivClass = panelRegion === 'east' ? ' class="cwrc-east-panel"' : '';
    return `
      <div class="cwrc tabs ui-layout-${panelRegion}${iconTabsClass}">
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
          ${panelConfig.map(({ id }) => `<div id="${this.editorId}-${id}"${panelDivClass}/>`).join('\n')}
        </div>
      </div>
    `;
  }

  private initModule(module: ModuleConfig) {
    const config = module.config || {};
    config.writer = this.writer;
    config.parentId = `${this.editorId}-${module.id}`;

    const traced = module.id === 'validation' || module.id === 'imageViewer';
    if (traced) {
      panelTrace('layoutManager: initModule', {
        module: module.id,
        parentId: config.parentId,
        parentBefore: describePanelNode(document.getElementById(config.parentId)),
      });
    }

    let instance = null;
    if (module.id === 'entities') instance = new EntitiesList(config);
    if (module.id === 'validation') instance = new Validation(config);
    if (module.id === 'imageViewer') instance = new ImageViewer(config);

    if (traced) {
      panelTrace('layoutManager: initModule done', {
        module: module.id,
        created: !!instance,
        parentAfter: describePanelNode(document.getElementById(config.parentId)),
      });
    }

    return instance;
  }
}

export default LayoutManager;
