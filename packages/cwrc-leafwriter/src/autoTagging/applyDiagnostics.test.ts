import { buildDocIndex, createAnchor } from './anchor';
import { applySuggestions } from './apply';
import { buildApplyDiagnosticsReport, explainAnchorFailure } from './applyDiagnostics';
import { normalizeDomText } from './normalize';
import type { Suggestion } from './types';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

describe('explainAnchorFailure', () => {
  it('reports missing xpath', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>義熙八年</p></body></text></TEI>`,
    );
    const reason = explainAnchorFailure(doc, {
      documentId: '',
      xpath: '/TEI/text/body/p[9]/text()[1]',
      offset: 0,
      surface: '義熙八年',
      occurrence: 1,
      contextBefore: '',
      contextAfter: '',
      nodeHash: 'x',
    }, 'ignore');
    expect(reason).toContain('XPath not found');
  });

  it('reports edited text node via hash mismatch', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>義熙九年</p></body></text></TEI>`,
    );
    const anchor = createAnchor('doc', doc, doc.getElementsByTagName('p')[0]!.firstChild as Text, 0, 4, 'ignore');
    anchor.surface = '義熙八年';
    anchor.nodeHash = 'stale-hash';
    const reason = explainAnchorFailure(doc, anchor, 'ignore');
    expect(reason).toContain('hash changed');
  });
});

describe('buildApplyDiagnosticsReport', () => {
  it('summarizes unresolvable date tags', async () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>義熙九年</p></body></text></TEI>`,
    );
    const goodDoc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>義熙八年</p></body></text></TEI>`,
    );
    const nodes = buildDocIndex(goodDoc, 'ignore').nodes;
    const textNode = nodes[0]!.node;
    const anchor = createAnchor('doc', goodDoc, textNode, 0, 4, 'ignore');

    const suggestion: Suggestion = {
      id: 'date_0',
      source: 'dates',
      action: 'add',
      tag: 'date',
      anchor,
      status: 'accepted',
    };

    const result = await applySuggestions(doc, [suggestion], { policy: 'ignore' });
    const report = buildApplyDiagnosticsReport(doc, result, { policy: 'ignore' });
    expect(result.applied).toBe(0);
    expect(report.lines).toHaveLength(1);
    expect(report.summary).toContain('0 of 1');
    expect(report.lines[0]!.outcome).toBe('unresolvable');
  });
});
