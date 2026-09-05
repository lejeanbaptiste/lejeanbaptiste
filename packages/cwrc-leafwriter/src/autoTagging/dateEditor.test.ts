import {
  dateAuthorityPackageLabel,
  dateEditorFields,
  toggleDateEditorField,
  updateDateAuthorityField,
  updateDateEditorField,
} from './dateEditor';
import type { Suggestion } from './types';

const suggestion = (): Suggestion => ({
  id: 'date_0',
  source: 'dates',
  sourceDetail: 'sanmiao',
  action: 'resolve-date',
  tag: 'date',
  anchor: {
    documentId: 'doc',
    xpath: '/TEI/text/body/p[1]/text()[1]',
    offset: 0,
    surface: '建元元年三月',
    occurrence: 1,
    contextBefore: '',
    contextAfter: '',
    nodeHash: 'n1',
  },
  attributes: { resp: '#grognard-sanmiao', cert: 'low' },
  status: 'pending',
  dateResolution: {
    status: 'ambiguous',
    candidates: [
      { displayLine: '建元 1', attrs: { era_id: '1', year: '1', month: '3' } },
      { displayLine: '建元 4', attrs: { era_id: '2', year: '4', month: '3' } },
    ],
    parseXml: '<era>建元</era><year>元年</year><month>三月</month>',
  },
});

describe('dateEditor', () => {
  it('marks source parse slots locked and missing finer slots out of bounds', () => {
    const fields = dateEditorFields(suggestion(), 1);
    expect(fields.find((field) => field.key === 'era')?.value).toBe('建元');
    expect(fields.find((field) => field.key === 'era')?.kind).toBe('locked');
    expect(fields.find((field) => field.key === 'year')?.value).toBe('4');
    expect(fields.find((field) => field.key === 'year')?.kind).toBe('locked');
    expect(fields.find((field) => field.key === 'year')?.editable).toBe(false);
    expect(fields.find((field) => field.key === 'month')?.value).toBe('3');
    expect(fields.find((field) => field.key === 'month')?.kind).toBe('locked');
    expect(fields.find((field) => field.key === 'day')?.kind).toBe('out-of-bounds');
    expect(fields.find((field) => field.key === 'day')?.editable).toBe(false);
  });

  it('builds an emperor · era package label, preferring can-names from era entries', () => {
    const item = suggestion();
    item.dateResolution!.selectedCandidateIndex = 0;
    item.dateResolution!.candidates![0]!.attrs = {
      era_id: '1',
      ruler_id: '7',
      year: '1',
      month: '3',
    };
    const label = dateAuthorityPackageLabel(item, 0, {
      dynasties: [],
      rulers: [{ rulerId: 7, dynId: 3, label: '劉邦', dynLabel: '漢', searchText: 'liubang' }],
      eras: [
        {
          eraId: 1,
          dynId: 3,
          rulerId: 7,
          label: '建元',
          dynLabel: '漢',
          rulerLabel: '高祖',
          searchText: 'jianyuan',
        },
      ],
    });
    expect(label).toBe('高祖 · 建元');
  });

  it('keeps inline edits ahead of Sanmiao candidate attributes', () => {
    const item = suggestion();
    item.dateResolution!.selectedCandidateIndex = 1;
    updateDateEditorField(item, 'day', '4');
    expect(dateEditorFields(item, 1).find((field) => field.key === 'day')?.value).toBe('4');
    expect(dateEditorFields(item, 1).find((field) => field.key === 'day')?.kind).toBe('resolved');
    expect(item.dateResolution?.editorAttributes?.day).toBe('4');
  });

  it('cycles intercalary and lunar phase toggles', () => {
    const item = suggestion();
    toggleDateEditorField(item, 'intercalary');
    expect(item.attributes?.intercalary).toBe('1');
    toggleDateEditorField(item, 'lp');
    expect(item.attributes?.lp).toBe('0');
    toggleDateEditorField(item, 'lp');
    expect(item.attributes?.lp).toBe('-1');
    toggleDateEditorField(item, 'lp');
    expect(item.attributes?.lp).toBeUndefined();
  });

  it('links era selection to its ruler and dynasty IDs', () => {
    const item = suggestion();
    updateDateAuthorityField(item, 'era', {
      eraId: 22,
      dynId: 3,
      rulerId: 7,
      label: '建元',
      dynLabel: '魏',
      rulerLabel: '武帝',
    });
    expect(item.attributes).toEqual(
      expect.objectContaining({ era_id: '22', ruler_id: '7', dyn_id: '3' }),
    );
  });
});
