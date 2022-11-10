# About

LEAF-Writer provides:

- schema-aware document editing, including validation, against web-accessible schemas
- support for cascading stylesheets (CSS) to provide a WYSIWYG view of documents, as well as a view showing tags
- the ability to extract references to named entities (persons, places, or organizations) from already tagged XML references within a document in order to generate Web Annotation
- the ability to look up and select identifiers for named entity tags (persons, organizations, places, or titles) from the following Linked Open Data authorities: DBPedia, Geonames, Getty, LGPN, VIAF, and Wikidata.
- generation of Linked Data annotations corresponding to newly tagged named entities and document annotations (dates, notes, citations, corrections, links, keywords) in XML-RDF or JSON-LD conforming to the Web Annotation Data Model
- continuous XML validation
- Shema-constrained tagging options

This version of LEAF-Writer uses the GitHub and Gitlab repositories for document storage, versioning, and sharing. To take advantage of these features, you need to be logged into a GitHub or Gitlab account. In addition, you can open documents by pasting an XML or uploading a file from your computer. You can also download the file directly to your device. Optionally, you can use LEAF-Writer without any external account, in which case you will only be able to load from and save to your computer.

LEAF-Writer is designed to work with [customizations of the Text Encoding Initiative (TEI)](https://tei-c.org/guidelines/customization/#section-1) schema provided by the TEI Consortium. Out-of-the-box, LEAF-Writer supports the following schemas: [TEI All](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng), [TEI Corpus](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_corpus.rng), [TEI Drama](https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_drama.rng), [TEI Manuscript](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_ms.rng), [TEI Speech](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_speech.rng), [TEI LITE](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng), [Orlando](https://cwrc.ca/schemas/orlando_entry.rng).

LEAF-Writer may also work with custom schemas. When you open a document, LEAF-Writer checks the root element and the schema definition. Currently, LEAF-Writer supports three different root elements: `TEI`, `ORLANDO`, and `CWRCENTRY`. If the root element is supported by the schema is not, you can add it as a personal custom schema.  LEAF-Writer saves the schema information on the Browser's localstorage. Then, the schema will be available locally as long as you remain logged in.

You can use LEAF-Writer to edit XML documents or produce new documents from templates. There are templates and sample documents here for getting started.

To learn more about how to use LEAF-Writer, see the [documentation](https://cwrc.ca/Documentation/public/DITA_Files-Various_Applications/CWRC-Writer/CWRCWriter_Started_Splash.html).

If you run into a bug or there is a feature you would like to see added, please submit a ticket to <https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues>.

If you are interested in adopting/adapting Leaf Writer to a different environment, please consult [this reference](https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer). You can contact us through a Gitlab ticket on any of the LEAF-Writer code repositories.

Finally, if you have found LEAF-Writer useful for your research or teaching, please let us know! We’d love to hear it.
