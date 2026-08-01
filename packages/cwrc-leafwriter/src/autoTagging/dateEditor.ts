import type { Suggestion } from './types';
import type {
  DateAuthorityIndex,
  DynastyAuthorityEntry,
  EraAuthorityEntry,
  RulerAuthorityEntry,
} from '../dateAuthority/types';

export type DateEditorKey =
  | 'dyn'
  | 'ruler'
  | 'era'
  | 'year'
  | 'sex_year'
  | 'month'
  | 'intercalary'
  | 'day'
  | 'gz'
  | 'lp'
  | 'nmd_gz';

export interface DateEditorField {
  key: DateEditorKey;
  label: string;
  value: string;
  editable: boolean;
}

const XML_FIELD_BY_KEY: Partial<Record<DateEditorKey, string>> = {
  dyn: 'dyn',
  ruler: 'ruler',
  era: 'era',
  year: 'year',
  sex_year: 'sexYear',
  month: 'month',
  intercalary: 'int',
  day: 'day',
  gz: 'gz',
  lp: 'lp',
  nmd_gz: 'nmdgz',
};

const ATTR_BY_KEY: Partial<Record<DateEditorKey, string>> = {
  dyn: 'dyn_id',
  ruler: 'ruler_id',
  era: 'era_id',
  year: 'year',
  sex_year: 'sex_year',
  month: 'month',
  intercalary: 'intercalary',
  day: 'day',
  gz: 'gz',
  lp: 'lp',
  nmd_gz: 'nmd_gz',
};

const LABELS: Record<DateEditorKey, string> = {
  dyn: 'dynasty',
  ruler: 'ruler',
  era: 'era',
  year: 'year',
  sex_year: 'sex-year',
  month: 'month',
  intercalary: '閏',
  day: 'day',
  gz: '干支',
  lp: 'phase',
  nmd_gz: 'new-moon 干支',
};

function parseInnerXml(xml: string | undefined): Map<string, string> {
  const values = new Map<string, string>();
  if (!xml || typeof DOMParser === 'undefined') return values;
  const parsed = new DOMParser().parseFromString(`<root>${xml}</root>`, 'application/xml');
  for (const element of Array.from(parsed.documentElement?.children ?? [])) {
    const key = element.localName;
    if (key && !values.has(key)) values.set(key, element.textContent ?? '');
  }
  return values;
}

function selectedAttributes(
  suggestion: Suggestion,
  selectedIndex: number | null,
): Record<string, string> {
  const candidate =
    selectedIndex != null
      ? suggestion.dateResolution?.candidates?.[selectedIndex]?.attrs
      : undefined;
  return {
    ...(suggestion.attributes ?? {}),
    ...(candidate ?? {}),
    ...(suggestion.dateResolution?.editorAttributes ?? {}),
  };
}

function displayValue(
  key: DateEditorKey,
  attrs: Record<string, string>,
  xml: Map<string, string>,
  authority?: DateAuthorityIndex | null,
): string {
  const attr = ATTR_BY_KEY[key];
  const isAuthorityKey = key === 'dyn' || key === 'ruler' || key === 'era';
  if (attr && attrs[attr] != null && (!isAuthorityKey || !!authority)) {
    if (key === 'dyn' && authority) {
      return (
        authority.dynasties.find((entry) => String(entry.dynId) === attrs[attr])?.label ??
        attrs[attr]!
      );
    }
    if (key === 'ruler' && authority) {
      return (
        authority.rulers.find((entry) => String(entry.rulerId) === attrs[attr])?.label ??
        attrs[attr]!
      );
    }
    if (key === 'era' && authority) {
      return (
        authority.eras.find((entry) => String(entry.eraId) === attrs[attr])?.label ?? attrs[attr]!
      );
    }
    if (key === 'intercalary') return attrs[attr] === '1' ? '閏' : '';
    if (key === 'lp')
      return attrs[attr] === '0' ? '朔' : attrs[attr] === '-1' ? '晦' : attrs[attr]!;
    return attrs[attr]!;
  }
  const xmlKey = XML_FIELD_BY_KEY[key];
  if (xmlKey && xml.has(xmlKey)) return xml.get(xmlKey)!;
  return '';
}

export function dateEditorFields(
  suggestion: Suggestion,
  selectedIndex: number | null,
  authority?: DateAuthorityIndex | null,
): DateEditorField[] {
  const attrs = selectedAttributes(suggestion, selectedIndex);
  const xml = parseInnerXml(suggestion.dateResolution?.parseXml);
  const keys: DateEditorKey[] = [
    'dyn',
    'era',
    'ruler',
    'year',
    'sex_year',
    'month',
    'intercalary',
    'day',
    'gz',
    'lp',
    'nmd_gz',
  ];
  return keys.map((key) => ({
    key,
    label: LABELS[key],
    value: displayValue(key, attrs, xml, authority),
    // Source parse elements are immutable; resolved attributes are the editable layer.
    editable:
      key === 'dyn' || key === 'ruler' || key === 'era'
        ? !!authority
        : !xml.has(XML_FIELD_BY_KEY[key] ?? '') || key === 'intercalary' || key === 'lp',
  }));
}

function setWorkingAttribute(suggestion: Suggestion, name: string, value: string): void {
  suggestion.attributes = { ...(suggestion.attributes ?? {}), resp: '#ljb-sanmiao', cert: 'high' };
  suggestion.dateResolution ??= { status: 'unique' };
  suggestion.dateResolution.editorAttributes = {
    ...(suggestion.dateResolution.editorAttributes ?? {}),
    [name]: value,
  };
  if (value) suggestion.attributes[name] = value;
  else delete suggestion.attributes[name];
}

export function updateDateAuthorityField(
  suggestion: Suggestion,
  key: 'dyn' | 'ruler' | 'era',
  entry: DynastyAuthorityEntry | RulerAuthorityEntry | EraAuthorityEntry | null,
): void {
  if (!entry) return;
  if (key === 'dyn' && 'dynId' in entry) {
    setWorkingAttribute(suggestion, 'dyn_id', String(entry.dynId));
    setWorkingAttribute(suggestion, 'ruler_id', '');
    setWorkingAttribute(suggestion, 'era_id', '');
    return;
  }
  if (key === 'ruler' && 'rulerId' in entry) {
    setWorkingAttribute(suggestion, 'ruler_id', String(entry.rulerId));
    setWorkingAttribute(suggestion, 'dyn_id', String(entry.dynId));
    const era = suggestion.attributes?.era_id;
    if (era) setWorkingAttribute(suggestion, 'era_id', '');
    return;
  }
  if (key === 'era' && 'eraId' in entry) {
    setWorkingAttribute(suggestion, 'era_id', String(entry.eraId));
    setWorkingAttribute(suggestion, 'dyn_id', String(entry.dynId));
    if (entry.rulerId != null) setWorkingAttribute(suggestion, 'ruler_id', String(entry.rulerId));
  }
}

/** Update the working resolution without changing the document's source text. */
export function updateDateEditorField(
  suggestion: Suggestion,
  key: DateEditorKey,
  value: string,
): void {
  const attr = ATTR_BY_KEY[key];
  if (!attr) return;
  const normalized =
    key === 'intercalary'
      ? value === '閏'
        ? '1'
        : ''
      : key === 'lp'
        ? value === '朔'
          ? '0'
          : value === '晦'
            ? '-1'
            : ''
        : value.trim();
  suggestion.attributes = { ...(suggestion.attributes ?? {}), resp: '#ljb-sanmiao', cert: 'high' };
  suggestion.dateResolution ??= { status: 'unique' };
  suggestion.dateResolution.editorAttributes = {
    ...(suggestion.dateResolution.editorAttributes ?? {}),
  };
  if (normalized) suggestion.attributes[attr] = normalized;
  else delete suggestion.attributes[attr];
  // Keep an explicit empty override so clearing a candidate value does not
  // reveal the original Sanmiao candidate again before Apply.
  suggestion.dateResolution.editorAttributes[attr] = normalized;
}

export function toggleDateEditorField(suggestion: Suggestion, key: 'intercalary' | 'lp'): void {
  const current = dateEditorFields(
    suggestion,
    suggestion.dateResolution?.selectedCandidateIndex ?? null,
  ).find((field) => field.key === key)?.value;
  if (key === 'intercalary') updateDateEditorField(suggestion, key, current === '閏' ? '' : '閏');
  else updateDateEditorField(suggestion, key, current === '' ? '朔' : current === '朔' ? '晦' : '');
}
