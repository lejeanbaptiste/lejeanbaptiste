import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, type ReactNode } from 'react';
import { collectTextNodes } from './anchor';
import { applySuggestions } from './apply';
import { dictionaryTag } from './dictionary';
import { generateFakeSuggestions } from './fakeSuggestions';
import { normalizeDomText } from './normalize';

jest.mock('react-virtuoso', () => ({
  Virtuoso: forwardRef(function MockVirtuoso(
    {
      data,
      itemContent,
    }: {
      data: unknown[];
      itemContent: (index: number, row: unknown) => ReactNode;
    },
    _ref,
  ) {
    return (
      <div data-testid="virtuoso-item-list">
        {data.map((row, index) => (
          <div key={index}>{itemContent(index, row)}</div>
        ))}
      </div>
    );
  }),
}));

import { ReviewPanel } from './ReviewPanel';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const TEI = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p>上陽子曰：老君出真文。又見上陽子。</p>
</body></text></TEI>`;

const setup = () => {
  const doc = parse(TEI);
  const suggestions = generateFakeSuggestions(doc, [
    { surface: '上陽子', tag: 'persName' },
    { surface: '老君', tag: 'persName' },
  ]);
  return { doc, suggestions };
};

describe('ReviewPanel', () => {
  it('renders the batch and walks it with the keyboard', async () => {
    const { doc, suggestions } = setup();
    const applied: string[] = [];
    const rejected: string[] = [];
    render(
      <ReviewPanel
        suggestions={suggestions}
        onApply={async (accepted, dismissed = []) => {
          rejected.push(...dismissed.map((s) => s.id));
          const { results } = await applySuggestions(doc, accepted, { policy: 'ignore' });
          applied.push(
            ...results.filter((r) => r.outcome === 'applied').map((r) => r.suggestion.id),
          );
        }}
      />,
    );

    expect(suggestions).toHaveLength(3); // 上陽子 ×2, 老君 ×1
    const panel = screen.getByTestId('review-panel');

    // accept first, reject second, accept third — last judgement auto-commits
    fireEvent.keyDown(panel, { key: 'a' });
    fireEvent.keyDown(panel, { key: 'r' });
    fireEvent.keyDown(panel, { key: 'Enter' });

    await waitFor(() => expect(applied).toHaveLength(2));
    expect(rejected).toHaveLength(1);

    // the document actually got tagged
    const tagged = collectTextNodes(doc, 'ignore').filter(
      (n) => n.node.parentElement?.nodeName === 'persName',
    );
    expect(tagged).toHaveLength(2);
  });

  it('reports focus changes so the host can jump the editor', () => {
    const { suggestions } = setup();
    const focused: string[] = [];
    render(
      <ReviewPanel
        suggestions={suggestions}
        onApply={() => undefined}
        onFocus={(s) => focused.push(s.id)}
      />,
    );

    const panel = screen.getByTestId('review-panel');
    fireEvent.keyDown(panel, { key: 'j' });
    fireEvent.keyDown(panel, { key: 'j' });
    // initial + two moves, in document order: 上陽子, 老君, 上陽子 (fake_1 is the second
    // 上陽子 occurrence, which follows 老君/fake_2 in the text)
    expect(focused).toEqual(['fake_0', 'fake_2', 'fake_1']);
  });

  it('accepts and rejects via the row buttons (no keyboard needed)', () => {
    const { suggestions } = setup();
    render(<ReviewPanel suggestions={suggestions} onApply={() => undefined} />);
    const panel = screen.getByTestId('review-panel');

    fireEvent.click(screen.getByTestId(`accept-${suggestions[0]!.id}`));
    fireEvent.click(screen.getByTestId(`reject-${suggestions[1]!.id}`));
    expect(screen.getByTestId('review-counts').textContent).toContain('1 accepted');
    expect(screen.getByTestId('review-counts').textContent).toContain('1 rejected');
    // One item still pending — no auto-commit yet.
    expect(screen.getByTestId('review-counts').textContent).toContain('1 pending');

    // Backspace rejects the current row when the panel has focus
    fireEvent.keyDown(panel, { key: 'k' });
    fireEvent.keyDown(panel, { key: 'Backspace' });
    // Last judgement auto-commits and clears the walk.
    expect(screen.getByTestId('review-counts').textContent).toContain('0 pending');
    expect(screen.getByTestId('review-counts').textContent).toContain('0 accepted');
    expect(screen.getByTestId('review-counts').textContent).toContain('0 rejected');
  });

  it('shows an empty state', () => {
    render(<ReviewPanel suggestions={[]} onApply={() => undefined} />);
    expect(screen.getByText('Nothing to review.')).toBeTruthy();
  });

  it('apply all remaining accepts pending items and skips rejected ones', async () => {
    const { doc, suggestions } = setup();
    const applied: string[] = [];
    const rejected: string[] = [];
    render(
      <ReviewPanel
        suggestions={suggestions}
        onApply={async (accepted, dismissed = []) => {
          rejected.push(...dismissed.map((s) => s.id));
          const { results } = await applySuggestions(doc, accepted, { policy: 'ignore' });
          applied.push(
            ...results.filter((r) => r.outcome === 'applied').map((r) => r.suggestion.id),
          );
        }}
      />,
    );

    fireEvent.click(screen.getByTestId(`reject-${suggestions[1]!.id}`));
    fireEvent.click(screen.getByTestId('review-apply-all'));

    await waitFor(() => expect(applied).toHaveLength(2));
    expect(rejected).toEqual([suggestions[1]!.id]);
    expect(screen.getByText('Nothing to review.')).toBeTruthy();
  });

  it('can flip a decision from the expanded accepted group', () => {
    const { suggestions } = setup();
    render(<ReviewPanel suggestions={suggestions} onApply={() => undefined} />);

    fireEvent.click(screen.getByTestId(`accept-${suggestions[0]!.id}`));
    expect(screen.getByTestId('review-counts').textContent).toContain('1 accepted');

    fireEvent.click(screen.getByText(/Accepted \(1\)/));
    fireEvent.click(screen.getByTestId(`reject-${suggestions[0]!.id}`));
    expect(screen.getByTestId('review-counts').textContent).toContain('0 accepted');
    expect(screen.getByTestId('review-counts').textContent).toContain('1 rejected');
  });

  describe('same-span alternatives (one string, several tags)', () => {
    const setupAlternatives = () => {
      const doc = parse('<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>高祖與諸將論其功。</p></TEI>');
      const suggestions = dictionaryTag(
        doc,
        [
          { string: '高祖', tag: 'persName' },
          { string: '高祖', tag: 'title' },
        ],
        'ignore',
      );
      return { doc, suggestions };
    };

    it('stacks the alternatives as one navigation stop with a checkbox each', () => {
      const { suggestions } = setupAlternatives();
      render(<ReviewPanel suggestions={suggestions} onApply={() => undefined} />);

      const pers = suggestions.find((s) => s.tag === 'persName')!;
      const title = suggestions.find((s) => s.tag === 'title')!;

      // one grouped card, not two separate list rows
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.getByTestId(`review-group-${pers.id}`)).toBeTruthy();
      expect(screen.getByTestId(`alt-select-${pers.id}`)).toBeTruthy();
      expect(screen.getByTestId(`alt-select-${title.id}`)).toBeTruthy();
    });

    it('accepting applies the checked alternative and rejects the sibling', async () => {
      const { doc, suggestions } = setupAlternatives();
      const applied: string[] = [];
      render(
        <ReviewPanel
          suggestions={suggestions}
          onApply={async (accepted) => {
            const { results } = await applySuggestions(doc, accepted, { policy: 'ignore' });
            applied.push(
              ...results.filter((r) => r.outcome === 'applied').map((r) => r.suggestion.id),
            );
          }}
        />,
      );

      const pers = suggestions.find((s) => s.tag === 'persName')!;
      const title = suggestions.find((s) => s.tag === 'title')!;

      // check the title alternative, then accept the pair — auto-commits
      fireEvent.click(screen.getByTestId(`alt-select-${title.id}`));
      fireEvent.click(screen.getByTestId(`accept-group-${pers.id}`));

      await waitFor(() => expect(applied).toEqual([title.id]));
      expect(doc.getElementsByTagName('title')).toHaveLength(1);
      expect(doc.getElementsByTagName('persName')).toHaveLength(0);
    });

    it('rejecting drops the whole pair, not just one alternative', async () => {
      const { suggestions } = setupAlternatives();
      const rejected: string[] = [];
      render(
        <ReviewPanel
          suggestions={suggestions}
          onApply={(_accepted, dismissed = []) => {
            rejected.push(...dismissed.map((s) => s.id));
          }}
        />,
      );

      const pers = suggestions.find((s) => s.tag === 'persName')!;
      fireEvent.click(screen.getByTestId(`reject-group-${pers.id}`));

      await waitFor(() => expect(rejected).toHaveLength(2));
      expect(screen.getByText('Nothing to review.')).toBeTruthy();
    });

    it('Space cycles the checked alternative via the keyboard', () => {
      const { suggestions } = setupAlternatives();
      render(<ReviewPanel suggestions={suggestions} onApply={() => undefined} />);
      const panel = screen.getByTestId('review-panel');

      const pers = suggestions.find((s) => s.tag === 'persName')!;
      const title = suggestions.find((s) => s.tag === 'title')!;

      const checkboxInput = (id: string) =>
        screen.getByTestId(`alt-select-${id}`).querySelector('input')!;

      expect(checkboxInput(pers.id).checked).toBe(true);
      fireEvent.keyDown(panel, { key: ' ' });
      expect(checkboxInput(title.id).checked).toBe(true);
    });
  });

  describe('Norbert mandatory stage', () => {
    it('shows only nobleTitle rows when that stage is locked', () => {
      const { suggestions } = setup();
      const withNoble = [
        ...suggestions,
        {
          ...suggestions[0]!,
          id: 'noble-1',
          tag: 'nobleTitle',
          status: 'pending' as const,
        },
      ];

      render(
        <ReviewPanel
          suggestions={withNoble}
          onApply={() => undefined}
          mandatoryStage="nobleTitle"
        />,
      );

      expect(screen.getByText('nobleTitle')).toBeTruthy();
      expect(screen.queryByText('All tags')).toBeNull();
      // Only the noble-title row is listed; the original persName rows are hidden.
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.getByTestId('review-item-noble-1')).toBeTruthy();
      expect(screen.getByTestId('review-counts').textContent).toContain('1 pending');
    });

    it('shows only personWrapper rows when that stage is locked', () => {
      const { suggestions } = setup();
      const withWrapper = [
        ...suggestions,
        {
          ...suggestions[0]!,
          id: 'wrapper-1',
          tag: 'name',
          attributes: { type: 'personWrapper' },
          status: 'pending' as const,
        },
      ];

      render(
        <ReviewPanel
          suggestions={withWrapper}
          onApply={() => undefined}
          mandatoryStage="personWrapper"
        />,
      );

      expect(screen.getByText('personWrapper')).toBeTruthy();
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.getByTestId('review-item-wrapper-1')).toBeTruthy();
    });

    it('auto-commits when the last pending item is judged', async () => {
      const { suggestions } = setup();
      const nobleOnly = [
        {
          ...suggestions[0]!,
          id: 'noble-1',
          tag: 'nobleTitle',
          status: 'pending' as const,
        },
        {
          ...suggestions[0]!,
          id: 'noble-2',
          tag: 'nobleTitle',
          status: 'pending' as const,
          anchor: { ...suggestions[0]!.anchor, surface: '魏王' },
        },
      ];
      const applied: { accepted: string[]; rejected: string[] }[] = [];

      render(
        <ReviewPanel
          suggestions={nobleOnly}
          onApply={(accepted, rejected = []) => {
            applied.push({
              accepted: accepted.map((s) => s.id),
              rejected: rejected.map((s) => s.id),
            });
          }}
          mandatoryStage="nobleTitle"
        />,
      );

      fireEvent.click(screen.getByTestId('reject-noble-1'));
      expect(applied).toHaveLength(0);

      fireEvent.click(screen.getByTestId('reject-noble-2'));
      await waitFor(() => expect(applied).toHaveLength(1));
      expect(applied[0]!.accepted).toEqual([]);
      expect([...applied[0]!.rejected].sort()).toEqual(['noble-1', 'noble-2']);
    });
  });

  describe('thing sub-type chip labels and filtering', () => {
    const customThingTypes = [{ id: 'philosophical_concept', label: 'Philosophical concept' }];

    it('renders the human label for an <rs type="..."> suggestion', () => {
      const { suggestions } = setup();
      const withThing = [
        {
          ...suggestions[0]!,
          id: 'thing-1',
          tag: 'rs',
          attributes: { type: 'philosophical_concept' },
          status: 'pending' as const,
        },
      ];

      render(
        <ReviewPanel
          suggestions={withThing}
          onApply={() => undefined}
          customThingTypes={customThingTypes}
        />,
      );

      expect(screen.getByText('<rs type="Philosophical concept">')).toBeTruthy();
    });

    it('falls back to the raw sub-type id when it has no matching custom type', () => {
      const { suggestions } = setup();
      const withThing = [
        {
          ...suggestions[0]!,
          id: 'thing-1',
          tag: 'rs',
          attributes: { type: 'medicinal_plant' },
          status: 'pending' as const,
        },
      ];

      render(
        <ReviewPanel
          suggestions={withThing}
          onApply={() => undefined}
          customThingTypes={customThingTypes}
        />,
      );

      expect(screen.getByText('<rs type="medicinal_plant">')).toBeTruthy();
    });

    it('offers a per-subtype filter option and narrows the list to it', () => {
      const { suggestions } = setup();
      const mixed = [
        {
          ...suggestions[0]!,
          id: 'thing-1',
          tag: 'rs',
          attributes: { type: 'philosophical_concept' },
          status: 'pending' as const,
        },
        {
          ...suggestions[1]!,
          id: 'thing-2',
          tag: 'rs',
          status: 'pending' as const,
        },
      ];

      render(
        <ReviewPanel
          suggestions={mixed}
          onApply={() => undefined}
          customThingTypes={customThingTypes}
        />,
      );

      expect(screen.getAllByRole('listitem')).toHaveLength(2);

      fireEvent.mouseDown(screen.getByRole('combobox'));
      fireEvent.click(screen.getByRole('option', { name: '<rs type="Philosophical concept">' }));

      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.getByTestId('review-item-thing-1')).toBeTruthy();
    });
  });
});
