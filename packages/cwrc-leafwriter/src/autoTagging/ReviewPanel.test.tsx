import { fireEvent, render, screen } from '@testing-library/react';
import { collectTextNodes } from './anchor';
import { applySuggestions } from './apply';
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
  it('renders the batch and walks it with the keyboard', () => {
    const { doc, suggestions } = setup();
    const applied: string[] = [];
    render(
      <ReviewPanel
        suggestions={suggestions}
        onApply={(accepted) => {
          const { results } = applySuggestions(doc, accepted, { policy: 'ignore' });
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
    expect(applied).toHaveLength(2);

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

    fireEvent.click(screen.getByTestId(`accept-${suggestions[0]!.id}`));
    fireEvent.click(screen.getByTestId(`reject-${suggestions[1]!.id}`));
    expect(screen.getByTestId('review-counts').textContent).toContain('1 accepted');
    expect(screen.getByTestId('review-counts').textContent).toContain('1 rejected');

    // a decided row offers undo, restoring it to pending
    fireEvent.click(screen.getByTestId(`undo-${suggestions[0]!.id}`));
    expect(screen.getByTestId('review-counts').textContent).toContain('0 accepted');
  });

  it('shows an empty state', () => {
    render(<ReviewPanel suggestions={[]} onApply={() => {}} />);
    expect(screen.getByText('Nothing to review.')).toBeTruthy();
  });
});
