import {
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
  attributes: { resp: '#ljb-sanmiao', cert: 'low' },
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
  it('combines parse fields with the selected resolution candidate', () => {
    const fields = dateEditorFields(suggestion(), 1);
    expect(fields.find((field) => field.key === 'era')?.value).toBe('建元');
    expect(fields.find((field) => field.key === 'year')?.value).toBe('4');
    expect(fields.find((field) => field.key === 'month')?.value).toBe('3');
    expect(fields.find((field) => field.key === 'year')?.editable).toBe(false);
  });

  it('keeps inline edits ahead of Sanmiao candidate attributes', () => {
    const item = suggestion();
    item.dateResolution!.selectedCandidateIndex = 1;
    updateDateEditorField(item, 'day', '4');
    expect(dateEditorFields(item, 1).find((field) => field.key === 'day')?.value).toBe('4');
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
