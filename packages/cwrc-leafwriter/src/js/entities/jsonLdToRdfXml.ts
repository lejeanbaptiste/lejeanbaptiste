type JsonLdContextValue = string | { '@id'?: string; '@type'?: string };
type JsonLdContext = Record<string, JsonLdContextValue> & { '@language'?: string };
type JsonLdNode = Record<string, unknown>;

const RDF_NAMESPACE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD_NAMESPACE = 'http://www.w3.org/2001/XMLSchema#';

const escapeXml = (value: unknown) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const isNode = (value: unknown): value is JsonLdNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const splitCompactIri = (value: string) => {
  const separator = value.indexOf(':');
  return separator > 0 ? [value.slice(0, separator), value.slice(separator + 1)] : undefined;
};

const expandIri = (value: string, context: JsonLdContext) => {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value;

  const parts = splitCompactIri(value);
  const namespace = parts && context[parts[0]];
  return parts && typeof namespace === 'string' ? `${namespace}${parts[1]}` : value;
};

const predicateName = (value: string, context: JsonLdContext) => {
  const alias = context[value];
  const iri = isNode(alias) && typeof alias['@id'] === 'string' ? alias['@id'] : value;
  const parts = splitCompactIri(iri);

  if (!parts || typeof context[parts[0]] !== 'string') {
    throw new Error(`Cannot serialize JSON-LD predicate without a namespace: ${value}`);
  }

  return `${parts[0]}:${parts[1]}`;
};

const literalAttributes = (predicate: string, value: unknown, context: JsonLdContext) => {
  const definition = context[predicate];
  if (isNode(definition) && typeof definition['@type'] === 'string') {
    return ` rdf:datatype="${escapeXml(expandIri(definition['@type'], context))}"`;
  }

  if (typeof value === 'number') {
    const datatype = Number.isInteger(value) ? 'integer' : 'double';
    return ` rdf:datatype="${XSD_NAMESPACE}${datatype}"`;
  }

  if (typeof value === 'boolean') {
    return ` rdf:datatype="${XSD_NAMESPACE}boolean"`;
  }

  return typeof context['@language'] === 'string'
    ? ` xml:lang="${escapeXml(context['@language'])}"`
    : '';
};

/**
 * Serializes the compact JSON-LD shape used by LEAF-Writer annotations.
 * It intentionally avoids implementing the full JSON-LD specification.
 */
export const jsonLdToRdfXml = (document: JsonLdNode) => {
  const context = document['@context'];
  if (!isNode(context)) throw new Error('JSON-LD annotation is missing an object @context');

  const jsonLdContext = context as JsonLdContext;
  const namespaces = Object.entries(jsonLdContext).filter(
    ([prefix, uri]) => !prefix.startsWith('@') && typeof uri === 'string',
  ) as [string, string][];

  if (!namespaces.some(([prefix]) => prefix === 'rdf')) {
    namespaces.unshift(['rdf', RDF_NAMESPACE]);
  }

  const nodes: { id?: string; nodeId?: string; value: JsonLdNode }[] = [];
  let blankNodeIndex = 0;

  const addNode = (value: JsonLdNode, root = false) => {
    const idValue = value['@id'] ?? (root ? value.id : undefined);
    const reference =
      typeof idValue === 'string' ? { id: idValue } : { nodeId: `leaf${blankNodeIndex++}` };
    nodes.push({ ...reference, value });
    return reference;
  };

  addNode(document, true);

  for (const node of nodes) {
    for (const [predicate, rawValue] of Object.entries(node.value)) {
      if (predicate === '@context' || predicate === '@id' || predicate === '@type') continue;
      if (predicate === 'id' || predicate === 'type') continue;

      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        if (isNode(value)) addNode(value);
      }
    }
  }

  const descriptions = nodes.map((node) => {
    const subject = node.id
      ? ` rdf:about="${escapeXml(node.id)}"`
      : ` rdf:nodeID="${escapeXml(node.nodeId)}"`;
    const properties: string[] = [];
    const typeValue = node.value['@type'] ?? node.value.type;
    const types = Array.isArray(typeValue) ? typeValue : typeValue ? [typeValue] : [];

    for (const type of types) {
      if (typeof type === 'string') {
        properties.push(`<rdf:type rdf:resource="${escapeXml(expandIri(type, jsonLdContext))}"/>`);
      }
    }

    for (const [predicate, rawValue] of Object.entries(node.value)) {
      if (['@context', '@id', '@type', 'id', 'type'].includes(predicate)) continue;

      const name = predicateName(predicate, jsonLdContext);
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        if (value === undefined || value === null) continue;

        if (isNode(value)) {
          const child = nodes.find((candidate) => candidate.value === value);
          const attribute = child?.id
            ? `rdf:resource="${escapeXml(child.id)}"`
            : `rdf:nodeID="${escapeXml(child?.nodeId)}"`;
          properties.push(`<${name} ${attribute}/>`);
        } else {
          const attributes = literalAttributes(predicate, value, jsonLdContext);
          properties.push(`<${name}${attributes}>${escapeXml(value)}</${name}>`);
        }
      }
    }

    return `<rdf:Description${subject}>${properties.join('')}</rdf:Description>`;
  });

  const namespaceAttributes = namespaces
    .map(([prefix, uri]) => `xmlns:${prefix}="${escapeXml(uri)}"`)
    .join(' ');
  return `<rdf:RDF ${namespaceAttributes}>${descriptions.join('')}</rdf:RDF>`;
};
