import $ from 'jquery';

import type Writer from '../js/Writer';
import { handleGraphics, refreshGraphicsInBody } from '../js/schema/mappings/utitlities';

export interface KanripoGaijiContext {
  gElement: Element;
  graphicElement: Element;
  gaijiId: string;
}

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');

const parentDir = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const slash = Math.max(normalized.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return slash >= 0 ? filePath.slice(0, slash) : filePath;
};

export const gaijiDirForDocument = (documentPath: string): string =>
  joinPath(parentDir(documentPath), '_gaiji');

export const relativeGaijiUrl = (fileName: string): string => `_gaiji/${fileName}`;

export const resolveKanripoGaijiContext = (
  element: Element | null | undefined,
): KanripoGaijiContext | null => {
  if (!element) return null;

  let graphicElement: Element | null = null;
  let gElement: Element | null = null;

  if (element.getAttribute('_tag') === 'graphic') {
    graphicElement = element;
    gElement = element.parentElement;
  } else if (element.getAttribute('_tag') === 'g' && element.getAttribute('type') === 'kanripo') {
    gElement = element;
    graphicElement = element.querySelector('[_tag="graphic"], [_tag="GRAPHIC"]');
  }

  if (!gElement || !graphicElement) return null;
  if (gElement.getAttribute('_tag') !== 'g' || gElement.getAttribute('type') !== 'kanripo')
    return null;

  const gaijiId = gElement.getAttribute('n') || '';
  if (!gaijiId) return null;

  return { gElement, graphicElement, gaijiId };
};

export const getClipboardImageFile = (clipboard: DataTransfer): File | null => {
  for (const item of Array.from(clipboard.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
};

export const blobToUint8Array = async (blob: Blob): Promise<Uint8Array> => {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
};

export const generatePastedGaijiId = (): string => `KR-paste-${Date.now().toString(36)}`;

export const generatePastedGaijiFileName = (): string => `paste-${Date.now().toString(36)}.png`;

export const saveGaijiImageBytes = async (
  bytes: Uint8Array,
  fileName: string,
): Promise<string | null> => {
  const docPath = window.__leafWriterProject?.getActiveFilePath?.();
  const api = window.electronAPI;
  if (!docPath || !api?.writeBinaryFile || !api.ensureDirectory) return null;

  const dir = gaijiDirForDocument(docPath);
  await api.ensureDirectory(dir);
  const absolute = joinPath(dir, fileName);
  await api.writeBinaryFile(absolute, bytes);
  return relativeGaijiUrl(fileName);
};

export const graphicHeightEm = (graphicElement: Element, writer: Writer): string => {
  const fromDom = graphicElement.getAttribute('height')?.trim();
  if (fromDom) return fromDom;
  const fromAttrs = writer.tagger.getAttributesForTag(graphicElement).height;
  return typeof fromAttrs === 'string' && fromAttrs.trim() ? fromAttrs.trim() : '1em';
};

const refreshGraphicElement = (writer: Writer, graphicElement: Element) => {
  const $graphic = $(graphicElement);
  $graphic.removeClass('lw-inline-graphic lw-kanripo-gaiji');
  $graphic.removeAttr('style');
  $graphic.removeAttr('contenteditable');
  graphicElement.parentElement?.classList.remove('lw-kanripo-gaiji-wrap');
  if (graphicElement.parentElement?.getAttribute('type') === 'kanripo') {
    graphicElement.parentElement.removeAttribute('style');
  }
  handleGraphics($graphic, {
    documentFilePath: window.__leafWriterProject?.getActiveFilePath?.() ?? null,
  });
};

export const insertKanripoGaiji = async (
  writer: Writer,
  options: { gaijiId: string; relativeUrl: string; heightEm?: string },
): Promise<boolean> => {
  const bookmark = writer.editor?.selection.getBookmark(1);
  if (!bookmark) return false;

  const height = options.heightEm ?? '1em';
  const gTag = writer.tagger.addStructureTag({
    action: writer.tagger.ADD,
    tagName: 'g',
    attributes: { type: 'kanripo', n: options.gaijiId },
    bookmark,
  });
  if (!gTag?.id) return false;

  writer.tagger.addStructureTag({
    action: writer.tagger.INSIDE,
    tagName: 'graphic',
    attributes: { url: options.relativeUrl, height },
    bookmark: { tagId: gTag.id },
  });

  const body = writer.editor?.getBody();
  if (body) {
    refreshGraphicsInBody(body, {
      documentFilePath: window.__leafWriterProject?.getActiveFilePath?.() ?? null,
    });
    writer.tagger.processNewContent(body);
  }
  writer.event('contentChanged').publish();
  return true;
};

export const handleKanripoGaijiImagePaste = async (
  writer: Writer,
  file: File,
): Promise<boolean> => {
  const bytes = await blobToUint8Array(file);
  const relativeUrl = await saveGaijiImageBytes(bytes, generatePastedGaijiFileName());
  if (!relativeUrl) return false;

  return insertKanripoGaiji(writer, {
    gaijiId: generatePastedGaijiId(),
    relativeUrl,
  });
};

export const updateKanripoGaijiHeight = (
  writer: Writer,
  graphicElement: Element,
  heightEm: string,
): void => {
  writer.tagger.setAttributesForTag(graphicElement, {
    ...writer.tagger.getAttributesForTag(graphicElement),
    height: heightEm,
  });
  refreshGraphicElement(writer, graphicElement);
  writer.editor?.undoManager.add();
  writer.event('contentChanged').publish();
};

export const replaceKanripoGaijiImage = async (
  writer: Writer,
  graphicElement: Element,
  file: File,
): Promise<boolean> => {
  const bytes = await blobToUint8Array(file);
  const relativeUrl = await saveGaijiImageBytes(bytes, generatePastedGaijiFileName());
  if (!relativeUrl) return false;

  writer.tagger.setAttributesForTag(graphicElement, {
    ...writer.tagger.getAttributesForTag(graphicElement),
    url: relativeUrl,
  });
  refreshGraphicElement(writer, graphicElement);
  writer.event('contentChanged').publish();
  return true;
};

export const pickImageFile = (): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
