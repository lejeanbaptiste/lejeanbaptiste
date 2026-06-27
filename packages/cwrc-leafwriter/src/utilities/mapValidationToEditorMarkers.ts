import type { ValidationError } from '@cwrc/leafwriter-validator';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import type { XMLValidity } from './checkWellFormedness';
import { findOpenTagOffset, offsetToLineColumn } from './xmlPosition';

const MARKER_SOURCE = 'leafwriter-validation';

export const mapWellFormednessToMarkers = (
  validity: Extract<XMLValidity, { valid: false }>,
): monaco.editor.IMarkerData[] => {
  const positions = validity.error.positions ?? [{ line: 1, col: 1 }];

  return positions.map((pos) => ({
    severity: monaco.MarkerSeverity.Error,
    message: pos.message ?? validity.error.message,
    startLineNumber: pos.line,
    startColumn: Math.max(pos.col, 1),
    endLineNumber: pos.line,
    endColumn: Math.max(pos.col + 1, 2),
  }));
};

export const mapValidationErrorsToMarkers = (
  xml: string,
  errors: ValidationError[],
): monaco.editor.IMarkerData[] => {
  return errors
    .map((error) => {
      const xpath =
        error.type === 'ElementNameError' && error.target.name && error.element?.xpath
          ? `${error.element.xpath}/${error.target.name}`
          : error.element?.xpath ?? error.target?.xpath ?? '';

      const offset = xpath ? findOpenTagOffset(xml, xpath) : null;
      const { line, col } =
        offset !== null ? offsetToLineColumn(xml, offset) : { line: 1, col: 1 };

      const highlightLength = error.target.name?.length ?? 1;

      return {
        severity: monaco.MarkerSeverity.Error,
        message: error.msg,
        startLineNumber: line,
        startColumn: col,
        endLineNumber: line,
        endColumn: col + highlightLength,
      };
    })
    .filter((marker) => marker.message);
};

export { MARKER_SOURCE };
