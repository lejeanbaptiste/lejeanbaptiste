import { collectTextNodes, createAnchor } from './anchor';
import type { Suggestion, SuggestionSource, WhitespacePolicy } from './types';

/**
 * Development-only producer: fabricates plausible suggestions from a real
 * document so the review UI can be built and demoed before any real method
 * (dictionary, dates, AI) exists. Finds occurrences of the given surfaces
 * and emits 'add' suggestions with varied sources/confidences/rationales.
 */
export function generateFakeSuggestions(
  doc: Document,
  surfaces: { surface: string; tag: string }[],
  policy: WhitespacePolicy = 'ignore',
): Suggestion[] {
  const sources: SuggestionSource[] = ['dictionary', 'ai', 'dates'];
  const suggestions: Suggestion[] = [];
  let counter = 0;

  for (const { surface, tag } of surfaces) {
    const nodes = collectTextNodes(doc, policy);
    for (const { node, search } of nodes) {
      let from = 0;
      while (true) {
        const idx = search.text.indexOf(surface, from);
        if (idx === -1) break;
        from = idx + 1;

        const rawStart = search.map[idx]!;
        const rawEnd = search.map[idx + surface.length - 1]! + 1;
        const source = sources[counter % sources.length]!;
        suggestions.push({
          id: `fake_${counter++}`,
          source,
          sourceDetail: source === 'dictionary' ? 'demo-table' : 'demo',
          action: 'add',
          tag,
          anchor: createAnchor('fake-doc', doc, node, rawStart, rawEnd, policy),
          confidence: source === 'dictionary' ? undefined : 0.5 + (counter % 5) * 0.1,
          rationale:
            source === 'ai'
              ? `Looks like a ${tag} from surrounding context.`
              : `Matched "${surface}" in demo-table.`,
          status: 'pending',
        });
      }
    }
  }

  return suggestions;
}
