import $ from 'jquery';
import 'jquery-ui';
import OpenSeaDragon from 'openseadragon';
import Writer from '../../../Writer';

interface ImageViewerProps {
  attribute?: string;
  parentId: string;
  tag?: string;
  writer: Writer;
}

class ImageViewer {
  readonly writer: Writer;
  readonly id: string;
  readonly tagName: string;
  readonly attrName: string;
  readonly $parent: JQuery<HTMLElement>;

  osd: any | null;

  $pageBreaks: any;
  currentIndex: number = -1;
  ignoreScroll: boolean = false;

  constructor({ attribute, parentId, tag, writer }: ImageViewerProps) {
    this.writer = writer;
    this.id = `${parentId}_imageViewer`;
    this.tagName = tag ?? 'pb'; // page break element name
    this.attrName = attribute ?? 'facs'; // attribute that stores the image URL

    const _this = this;

    $(`#${parentId}`).append(`
      <div id="${this.id}" class="imageViewer" style="background-color: #f5f5f5; color-scheme: light">
        <div class="toolbar">
          <div class="navigation">
            <span id="${this.id}_prev" class="lw-button">
              <i class="fas fa-arrow-left"></i>
            </span>
            <span id="${this.id}_next" class="lw-button">
              <i class="fas fa-arrow-right"></i>
            </span>
            <span class="pageInfo">
              <input type="text" class="currPage" /> / <span class="totalPages"/>
            </span>
          </div>
          <div class="zoom">
            <span id="${this.id}_zoomIn" class="lw-button">
              <i class="fas fa-search-plus"></i>
            </span>
            <span id="${this.id}_zoomOut" class="lw-button">
              <i class="fas fa-search-minus"></i>
            </span>
            <span id="${this.id}_home" class="lw-button">
              <i class="fas fa-compress"></i>
            </span>
          </div>
        </div>
        <div id="${this.id}_osd" class="image"></div>
      </div>
    `);

    $(`#${parentId}`).css('overflow', 'hidden');

    this.$parent = $(`#${this.id}`);

    // openseadragon instance
    this.osd = OpenSeaDragon({
      id: `${this.id}_osd`,
      sequenceMode: true,
      autoHideControls: false,
      showFullPageControl: false,
      previousButton: `${this.id}_prev`,
      nextButton: `${this.id}_next`,
      zoomInButton: `${this.id}_zoomIn`,
      zoomOutButton: `${this.id}_zoomOut`,
      homeButton: `${this.id}_home`,
    });

    this.writer.event('loadingDocument').subscribe(() => this.reset());
    this.writer.event('documentLoaded').subscribe((success: boolean, body: HTMLElement) => {
      if (!success) return;

      this.processDocument(body, true);
      setTimeout(this.cssHack, 50);
    });

    this.writer.event('contentChanged').subscribe(() => {
      const document = this.writer.editor?.getDoc();
      //@ts-ignore
      this.processDocument(document, false);
    });

    this.writer.event('writerInitialized').subscribe(() => {
      if (!this.writer.editor) return;
      $(this.writer.editor.getDoc()).on('scroll', () => this.handleScroll());
    });

    this.$parent.find('.image img').on('load', () => {
      this.resizeImage();
    });

    this.$parent.find('.currPage').on('keyup', function (event: any) {
      if (event.code === 'Enter') {
        let value = $(this).val();
        if (!value) return;

        if (Array.isArray(value)) value = value.join('');
        if (typeof value === 'string') value = parseInt(value);

        _this.osd.goToPage(value - 1);
        _this.loadPage(value - 1, true);
      }
    });

    this.osd.addHandler('open-failed', (event: any) => {
      let msg = event.message;
      if (event.source.url === true) msg = `No URI found for @${this.attrName}.`;
      this.setMessage(msg);
    });

    this.osd.addHandler('reset-size', (event: any) => {
      if (event.contentFactor !== 0) return;
      this.setMessage(`No URI found for @${this.attrName}.`);
    });

    this.osd.addHandler('page', (event: any) => {
      this.loadPage(event.page, true);
    });
  }

  // ensure page break tags are display block
  private cssHack() {
    if (!this.writer.editor) return;
    const rules = $(this.writer.editor.getDoc()).find('#schemaRules')[0];
    !rules
      ? setTimeout(this.cssHack, 50)
      : //@ts-ignore
        rules.sheet.insertRule(`*[_tag="${this.tagName}"] { display: block; }`, 0);
  }

  private osdReset() {
    this.osd.drawer.clear();
    this.osd.close();
    this.osd.tileSources = []; // hack to remove any previously added images
  }

  private processDocument(doc: HTMLElement, docLoaded: any) {
    this.setMessage('');

    this.$pageBreaks = $(doc).find(`*[_tag=${this.tagName}]`);

    if (this.$pageBreaks.length === 0) {
      this.hideViewer();
      return;
    }

    const tileSources: any[] = [];

    this.$pageBreaks.each((index: any, el: any) => {
      const url = $(el).attr(this.attrName);
      if (!url || url === '') return;

      tileSources.push({ type: 'image', url });
    });

    let needUpdate = docLoaded || tileSources.length !== this.osd.tileSources.length;

    if (!needUpdate) {
      for (let i = 0; i < tileSources.length; i++) {
        if (tileSources[i].url !== this.osd.tileSources[i].url) {
          needUpdate = true;
          break;
        }
      }
    }

    this.osd.open(tileSources);

    // tileSources.length === 0
    //   ? this.writer.layoutManager.hideModule('imageViewer')
    //   : this.writer.layoutManager.showModule('imageViewer');

    this.$parent.find('.totalPages').html(this.$pageBreaks.length);
    this.currentIndex = -1;
    this.handleScroll();
  }

  private setMessage(msg: string) {
    this.osd.drawer.clear();
    this.osd._showMessage(msg);
  }

  private hideViewer() {
    const msg = `
      Provide page breaks (${this.tagName}) with ${this.attrName} attributes
      pointing to image URLs in order to
      display the corresponding images/scans
      for pages in this doument.
    `;

    this.setMessage(msg);
    this.writer.layoutManager.hideModule('imageViewer');
  }

  private handleScroll() {
    if (!this.ignoreScroll && this.writer.editor) {
      const ifr = $('iframe', this.writer.editor.getContainer());
      const scrollHeight = ifr.height() ?? 0;
      const el = this.writer.editor.getDoc().scrollingElement;
      const scrollTop = el?.scrollTop ?? 0;
      const scrollBottom = scrollTop + scrollHeight;
      let index = -1;

      this.$pageBreaks.each((i: number, el: any) => {
        const y = $(el).offset()?.top;
        if (!y) return;

        if (y >= scrollTop && y < scrollBottom) {
          index = i;
          return false;
        }
      });

      this.ignoreScroll = true;
      this.osd.goToPage(index);
    }

    this.ignoreScroll = false;
  }

  private loadPage(index: number, doScroll: boolean) {
    //out of bounds
    if (index < 0 || index >= this.$pageBreaks.length) return;

    this.currentIndex = index;
    this.$parent.find('.currPage').val(this.currentIndex + 1);

    if (!this.ignoreScroll && doScroll) {
      this.ignoreScroll = true;
      const pb = this.$pageBreaks.get(this.currentIndex);
      if (this.currentIndex === 0) $(pb).show();
      pb.scrollIntoView();
      if (this.currentIndex === 0) $(pb).hide();
    }
  }

  private resizeImage() {
    const container = this.$parent.parent();
    const toolbarHeight = 30;
    const cw = container.width() ?? 0;
    const containerHeight = container.height() ?? 0;
    const ch = containerHeight === 0 ? 0 : containerHeight - toolbarHeight;

    const img = this.$parent.find('.image img');
    const iw = img.width() ?? 0;
    const ih = img.height() ?? 0;

    const cratio = ch / cw;
    const iratio = ih / iw;

    let nh = ch;
    let nw = cw;

    if (iratio >= 1) {
      // portrait
      if (iratio > cratio) {
        nh = ch;
        nw = nh / iratio;
      } else {
        nw = cw;
        nh = nw * iratio;
      }
    } else {
      // landscape
    }
    img.css('height', nh).css('width', nw).css('display', 'block');
  }

  reset() {
    this.$pageBreaks = null;
    this.currentIndex = -1;

    this.osdReset();
  }

  destroy() {
    this.osd.destroy();
    this.osd = null;
  }
}

// export const hasPBImages = (writer: any) => {

//   const .$pageBreaks = $(doc).find(`*[_tag=${this.tagName}]`);

//   if (this.$pageBreaks.length === 0) {
//     this.hideViewer();
//     return;
//   }

//   const tileSources: any[] = [];

//   this.$pageBreaks.each((index: any, el: any) => {
//     const url = $(el).attr(this.attrName);
//     if (!url || url === '') return;

//     tileSources.push({ type: 'image', url });
//   });

// }

export default ImageViewer;
