import { reconcile } from '../services/lincs-api';
import { AuthorityServiceConfig } from '../types';

export const authoritiesInitialConfig: AuthorityServiceConfig[] = [
  {
    name: 'VIAF',
    author: { name: 'LINCS Project' },
    description:
      'The VIAF® (Virtual International Authority File) combines multiple name authority files into a single OCLC-hosted name authority service. The goal of the service is to lower the cost and increase the utility of library authority files by matching and linking widely-used authority files and making that information available on the Web.',
    entityTypes: [
      { name: 'person', priority: 0 },
      { name: 'place', priority: 1 },
      { name: 'organization', priority: 0 },
      { name: 'work', priority: 0 },
      { name: 'thing', priority: 0 },
    ],
    url: 'https://viaf.org',
    search: reconcile,
  },
  {
    name: 'Wikidata',
    author: { name: 'LINCS Project' },
    description:
      'Wikidata is a free and open knowledge base that can be read and edited by both humans and machines. Wikidata acts as central storage for the structured data of its Wikimedia sister projects including Wikipedia, Wikivoyage, Wiktionary, Wikisource, and others.',
    entityTypes: [
      { name: 'person', priority: 1 },
      { name: 'place', priority: 2 },
      { name: 'organization', priority: 1 },
      { name: 'work', priority: 1 },
      { name: 'thing', priority: 1 },
    ],
    url: 'https://www.wikidata.org',
    search: reconcile,
  },
  {
    name: 'DBPedia',
    author: { name: 'LINCS Project' },
    description:
      'Since the emergence of the LOD Cloud in 2007 DBpedia constitutes the main resource of Linked Open Data on the Web containing more than 228 million entities to date. With the rapid growth of published LOD-datasets DBpedia evolved to the most interconnected freely available knowledge graph on the Web.',
    entityTypes: [
      { name: 'person', priority: 2 },
      { name: 'place', priority: 3 },
      { name: 'organization', priority: 2 },
      { name: 'work', priority: 2 },
      { name: 'thing', priority: 2 },
    ],
    url: 'https://www.dbpedia.org',
    search: reconcile,
  },
  {
    name: 'Getty',
    author: { name: 'LINCS Project' },
    description:
      'Getty Vocabularies are structured resources for the visual arts domain, including art, architecture, decorative arts, other cultural works, archival materials, visual surrogates, and art conservation.',
    entityTypes: [
      { name: 'person', priority: 3 },
      { name: 'place', priority: 4 },
      { name: 'organization', priority: 3 },
      { name: 'work', priority: 3 },
      { name: 'thing', priority: 3 },
    ],
    url: 'https://www.getty.edu/vocab/',
    search: reconcile,
  },
  {
    name: 'Geonames',
    author: { name: 'LINCS Project' },
    description:
      'The GeoNames geographical database covers all countries and contains over eleven million placenames that are available for download free of charge.',
    entityTypes: [{ name: 'place', priority: 0 }],
    url: 'https://www.geonames.org',
    search: reconcile,
  },
  {
    name: 'LINCS Project',
    author: { name: 'LINCS Project' },
    description:
      'LINCS provides the tools and infrastructure to make humanities data more discoverable, searchable, and shareable. Discover how you can explore, create, and publish cultural data.',
    entityTypes: [
      { name: 'person', priority: 4 },
      { name: 'place', priority: 5 },
      { name: 'organization', priority: 4 },
      { name: 'work', priority: 4 },
      { name: 'thing', priority: 4 },
    ],
    url: 'https://lincsproject.ca',
    search: reconcile,
  },
  {
    name: 'GND',
    author: { name: 'LINCS Project' },
    description:
      'The Integrated Authority File (GND) is a service facilitating the collaborative use and administration of authority data. These authority data represent and describe entities, i.e. persons, corporate bodies, conferences and events, geographic entities, topics and works relating to cultural and academic collections.',
    entityTypes: [
      { name: 'person', priority: 5 },
      { name: 'place', priority: 6 },
      { name: 'organization', priority: 5 },
      { name: 'work', priority: 5 },
      { name: 'thing', priority: 5 },
    ],
    url: 'https://www.dnb.de/EN/Professionell/Standardisierung/GND/gnd_node.html',
    search: reconcile,
  },
];
