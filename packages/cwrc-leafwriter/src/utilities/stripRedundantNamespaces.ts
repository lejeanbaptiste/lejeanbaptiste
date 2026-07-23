/**
 * Removes namespace declarations that merely repeat what an ancestor already
 * declares. XML namespace scoping means every descendant inherits its
 * ancestors' `xmlns`/`xmlns:*` bindings automatically; a redeclaration that
 * matches the inherited value changes nothing about how the element resolves
 * but shows up as noise in the exported XML (e.g. `<era xmlns="...">` next to
 * a `<date>` parent that already establishes the same default namespace).
 *
 * Unlike CJK whitespace stripping, this never changes document meaning —
 * removing a redundant declaration cannot alter any element's resolved
 * namespace — so it runs unconditionally, with no settings toggle.
 */

const isNamespaceDeclaration = (name: string): boolean => name === 'xmlns' || name.startsWith('xmlns:');

const declaredPrefix = (name: string): string | null => (name === 'xmlns' ? null : name.slice('xmlns:'.length));

/** Strip redundant `xmlns`/`xmlns:*` declarations from every element under `root`, in place. */
export function stripRedundantNamespacesInElement(root: Node): void {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;

  while (node) {
    const parent = node.parentNode;

    if (parent?.nodeType === Node.ELEMENT_NODE) {
      const namespaceAttrs = Array.from(node.attributes).filter((attr) => isNamespaceDeclaration(attr.name));

      for (const attr of namespaceAttrs) {
        const prefix = declaredPrefix(attr.name);
        const inherited = (parent as Element).lookupNamespaceURI(prefix);
        if (inherited === attr.value) node.removeAttribute(attr.name);
      }
    }

    node = walker.nextNode() as Element | null;
  }
}
