/**
 * @xmldom/xmldom's Element doesn't implement the browser `.children` getter
 * in the version pinned here, but `entities.ts`/`entityOps.ts` rely on it
 * everywhere (`Array.from(item.children)`). Without this shim `item.children`
 * is `undefined`, so any worker parsing XML with xmldom must call this once
 * per parsed document before touching it, or every child-iteration throws
 * "undefined is not iterable".
 */
export const installBrowserDomShim = (doc: Document): void => {
  const elementPrototype = Object.getPrototypeOf(doc.documentElement) as {
    children?: unknown;
  };
  if (!('children' in elementPrototype)) {
    const childrenCache = new WeakMap<Element, Element[]>();
    Object.defineProperty(elementPrototype, 'children', {
      configurable: true,
      get(this: Element) {
        const cached = childrenCache.get(this);
        if (cached) return cached;
        const children = Array.from(this.childNodes).filter(
          (node): node is Element => node.nodeType === 1,
        );
        childrenCache.set(this, children);
        return children;
      },
    });
  }
};
