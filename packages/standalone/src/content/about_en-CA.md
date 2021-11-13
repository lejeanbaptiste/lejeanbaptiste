# About

leaf-writer provides:

- schema-aware document editing, including validation, against web-accessible schemas
- support for cascading stylesheets (CSS) to provide a WYSIWYG view of documents, as well as a view showing tags
- ability to look up and select identifiers for named entity tags (persons, organization, places, or titles) from a range of Linked Open Data authorities
- generation (if desired) of Linked Data annotations corresponding to tags for named entities and document annotations (notes, citations, corrections, links) in XML-RDF or JSON-LD conforming to the Web Annotation Data Model, for both pre-existing and newly added tags
- ability to detect candidate named entities (persons, places, or organizations) within a document for tagging and/or Web Annotation, to evaluate and refine those suggestions, and to associate the entities with LOD identifiers

This version of leaf-writer uses the GitHub and Gitlab repositories for document storage, versioning, and sharing. You need to be logged into a GitHub or Gitlab account to use it.

leaf-writer is designed to work with customizations of the Text Encoding Initiative (TEI) schema provided by the TEI Consortium. (Schemas/CSS must be available at an `https://` location and have CORS enabled.)

You can use leaf-writer to edit XML documents or produce new documents from templates. There are templates and sample documents here for getting started. Producing Linked Open Data annotations is optional.

To learn more about how to use leaf-writer, see  [cwrc.ca/Documentation/CWRC-Writer](https://cwrc.ca/Documentation/CWRC-Writer). We recommend starting with the  _video tutorial_  and the  _quick start guide_.

If you run into a bug or there is a feature you would like to see added, please submit a ticket to [github.com/cwrc/CWRC-WriterBase/issues](https://github.com/cwrc/CWRC-WriterBase/issues).

If you are interested in adopting/adapting the Writer to a different environment, please consult [this reference](https://github.com/cwrc/tech_documentation/blob/master/Tools-reference.md#cwrc-writer). You can contact us through a GitHub ticket on any of the leaf-writer code repositories. Finally, if you have found leaf-writer useful for your research or teaching, please let us know! We’d love to hear it.
