import Utilities from '../utilities';
import { getParentsForTag, setSchemaElements, setSchemaJSON } from './schemaNavigator';

const fakeWriter = {} as any;
const utilities = new (Utilities as any)(fakeWriter);

/**
 * Reproduces the real tei_all.rng pattern where part of <div>'s content model
 * is written with an `rng:` prefix (e.g. `<rng:ref name="p"/>`) instead of
 * the unprefixed form used by the rest of the file, even though both resolve
 * to the RelaxNG structure namespace. ObjTree keys nodes by literal nodeName,
 * so without normalization this reference is invisible to schemaNavigator.
 */
const RNG_WITH_MIXED_PREFIXES = `<?xml version="1.0"?>
<grammar xmlns="http://relaxng.org/ns/structure/1.0">
  <define name="p">
    <element name="p"><text/></element>
  </define>
  <define name="div">
    <element name="div">
      <rng:optional xmlns:rng="http://relaxng.org/ns/structure/1.0">
        <rng:ref name="p"/>
      </rng:optional>
    </element>
  </define>
</grammar>`;

const loadSchemaJSON = (rngText: string) => {
  const doc = utilities.stringToXML(rngText);
  const grammar = doc.getElementsByTagName('grammar')[0];
  const json = utilities.xmlToJSON(grammar);
  setSchemaElements(['p', 'div']);
  setSchemaJSON(json);
};

describe('schemaNavigator: rng:-prefixed particles', () => {
  it('resolves p as a valid child of div even when the reference is rng:-prefixed', () => {
    loadSchemaJSON(RNG_WITH_MIXED_PREFIXES);

    const parents = getParentsForTag('p');
    expect(parents.some((parent) => parent.name === 'div')).toBe(true);
  });
});
