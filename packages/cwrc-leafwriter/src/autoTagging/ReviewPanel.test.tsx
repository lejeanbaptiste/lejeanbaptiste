import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { collectTextNodes } from './anchor';
import { applySuggestions } from './apply';
import { dictionaryTag } from './dictionary';
import { generateFakeSuggestions } from './fakeSuggestions';
import { normalizeDomText } from './normalize';
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
    render(
      <ReviewPanel
        suggestions={suggestions}
        onApply={async (accepted) => {
          const { results } = await applySuggestions(doc, accepted, { policy: 'ignore' });
          applied.push(...results.filter((r) => r.outcome === 'applied').map((r) => r.suggestion.id));
        }}
      />,
    );

    expect(suggestions).toHaveLength(3); // 上陽子 ×2, 老君 ×1
    const panel = screen.getByTestId('review-panel');

    // accept first, reject second, accept third
    fireEvent.keyDown(panel, { key: 'a' });
    fireEvent.keyDown(panel, { key: 'r' });
    fireEvent.keyDown(panel, { key: 'Enter' });

    expect(screen.getByTestId('review-counts').textContent).toContain('2 accepted');
    expect(screen.getByTestId('review-counts').textContent).toContain('1 rejected');

    fireEvent.click(screen.getByTestId('review-apply'));
    await waitFor(() => expect(applied).toHaveLength(2));

    // applied items leave the walk; the rejected one remains
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

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
        onApply={() => {}}
        onFocus={(s) => focused.push(s.id)}
      />,
    );

    const panel = screen.getByTestId('review-panel');
    fireEvent.keyDown(panel, { key: 'j' });
    fireEvent.keyDown(panel, { key: 'j' });
    expect(focused).toEqual(['fake_0', 'fake_1', 'fake_2']); // initial + two moves
  });

  it('accepts and rejects via the row buttons (no keyboard needed)', () => {
    const { suggestions } = setup();
    render(<ReviewPanel suggestions={suggestions} onApply={() => {}} />);
    const panel = screen.getByTestId('review-panel');

    fireEvent.click(screen.getByTestId(`accept-${suggestions[0]!.id}`));
    fireEvent.click(screen.getByTestId(`reject-${suggestions[1]!.id}`));
    expect(screen.getByTestId('review-counts').textContent).toContain('1 accepted');
    expect(screen.getByTestId('review-counts').textContent).toContain('1 rejected');

    // Backspace rejects the current row when the panel has focus
    fireEvent.keyDown(panel, { key: 'k' });
    fireEvent.keyDown(panel, { key: 'Backspace' });
    expect(screen.getByTestId('review-counts').textContent).toContain('2 rejected');

    // a decided row offers undo, restoring it to pending
    fireEvent.click(screen.getByTestId(`undo-${suggestions[0]!.id}`));
    expect(screen.getByTestId('review-counts').textContent).toContain('0 accepted');
  });

  it('shows an empty state', () => {
    render(<ReviewPanel suggestions={[]} onApply={() => {}} />);
    expect(screen.getByText('Nothing to review.')).toBeTruthy();
  });

  it('apply all remaining accepts pending items and skips rejected ones', async () => {
    const { doc, suggestions } = setup();
    const applied: string[] = [];
    render(
      <ReviewPanel
        suggestions={suggestions}
        onApply={async (accepted) => {
          const { results } = await applySuggestions(doc, accepted, { policy: 'ignore' });
          applied.push(...results.filter((r) => r.outcome === 'applied').map((r) => r.suggestion.id));
        }}
      />,
    );

    fireEvent.click(screen.getByTestId(`reject-${suggestions[1]!.id}`));
    fireEvent.click(screen.getByTestId('review-apply-all'));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(applied).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('can flip a decision from the expanded accepted group', () => {
    const { suggestions } = setup();
    render(<ReviewPanel suggestions={suggestions} onApply={() => {}} />);

    fireEvent.click(screen.getByTestId(`accept-${suggestions[0]!.id}`));
    expect(screen.getByTestId('review-counts').textContent).toContain('1 accepted');

    fireEvent.click(screen.getByText(/Accepted \(1\)/));
    fireEvent.click(screen.getByTestId(`reject-${suggestions[0]!.id}`));
    expect(screen.getByTestId('review-counts').textContent).toContain('0 accepted');
    expect(screen.getByTestId('review-counts').textContent).toContain('1 rejected');
  });

  describe('same-span alternatives (one string, several tags)', () => {
    const setupAlternatives = () => {
      const doc = parse(
        '<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>高祖與諸將論其功。</p></TEI>',
      );
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
      render(<ReviewPanel suggestions={suggestions} onApply={() => {}} />);

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

      // check the title alternative, then accept the pair
      fireEvent.click(screen.getByTestId(`alt-select-${title.id}`));
      fireEvent.click(screen.getByTestId(`accept-group-${pers.id}`));

      expect(screen.getByTestId('review-counts').textContent).toContain('1 accepted');
      expect(screen.getByTestId('review-counts').textContent).toContain('1 rejected');

      fireEvent.click(screen.getByTestId('review-apply'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(applied).toEqual([title.id]);
      expect(doc.getElementsByTagName('title')).toHaveLength(1);
      expect(doc.getElementsByTagName('persName')).toHaveLength(0);
    });

    it('rejecting drops the whole pair, not just one alternative', () => {
      const { suggestions } = setupAlternatives();
      render(<ReviewPanel suggestions={suggestions} onApply={() => {}} />);

      const pers = suggestions.find((s) => s.tag === 'persName')!;
      fireEvent.click(screen.getByTestId(`reject-group-${pers.id}`));

      expect(screen.getByTestId('review-counts').textContent).toContain('2 rejected');
      expect(screen.getByTestId('review-counts').textContent).toContain('0 pending');
    });

    it('Space cycles the checked alternative via the keyboard', () => {
      const { suggestions } = setupAlternatives();
      render(<ReviewPanel suggestions={suggestions} onApply={() => {}} />);
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
});