import {
  AuthorityLookupParams,
  AuthorityLookupResult,
  LocalAuthorityServiceConfig,
} from '../types';

export const catcor: LocalAuthorityServiceConfig = {
  id: 'catcor',
  name: 'CatCor',
  description: 'An example for a custom entity lookup service for LEAF-Writer',
  author: { name: 'CWRC Team', url: 'https://www.cwrc.ca/' },
  entityTypes: [
    {
      name: 'person',
      url: 'https://raw.githubusercontent.com/LEAF-VRE/CatCor/refs/heads/main/CatCor_People.xml',
    },
    {
      name: 'place',
      url: 'https://raw.githubusercontent.com/LEAF-VRE/CatCor/refs/heads/main/CatCor_Places.xml',
    },
    {
      name: 'organization',
      url: 'https://raw.githubusercontent.com/LEAF-VRE/CatCor/refs/heads/main/CatCor_Orgs.xml',
    },
    {
      name: 'work',
      url: 'https://raw.githubusercontent.com/LEAF-VRE/CatCor/refs/heads/main/CatCor_Works.xml',
    },
  ],
  searchType: 'TEI-FILE',
  options: {
    maxResults: 10,
  },
};

//TODO - implement Fuzzy search
// https://www.fusejs.io/
//https://www.npmjs.com/package/xml-js

//TODO - Guidance... add to the UI
// https://docs.google.com/document/d/1R5NvSXMZZDMcvNg85fBTCZlAyLUlG7Q_-2KLVqDvpxU/edit?tab=t.0

const DEFAULT_MAX_RESULTS = 5;

export async function teiFileBasedSearch({ query, entityType }: AuthorityLookupParams) {
  // @ts-ignore --  Typescript does not recognise `this` as variable (i.e., of 'any' type).
  // The context `this` must be assigned to the authority at the type it is setup.
  const serviceConfig = this as LocalAuthorityServiceConfig;
  // console.log(serviceConfig);

  //@ts-ignore -- Same as above
  if (!this) {
    throw new Error('No service config provided');
  }

  // Check if entity type is defined in the service config
  if (!serviceConfig.entityTypes.find((et) => et.name === entityType)) {
    throw new Error(`Entity type ${entityType} not found in service ${serviceConfig.id}`);
  }

  const entityTypeUrl = serviceConfig.entityTypes.find((et) => et.name === entityType)?.url;
  // Check if entity type urlis defined in the service config
  if (!entityTypeUrl) {
    throw new Error(`Entity type ${entityType} not found in service ${serviceConfig.id}`);
  }

  const matches: AuthorityLookupResult[] = [];
  const maxResults = serviceConfig.options?.maxResults ?? DEFAULT_MAX_RESULTS;

  //get file content
  const DATA = await fetch(entityTypeUrl).then((res) => res.text());

  const doc = new DOMParser().parseFromString(DATA, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error('Error parsing XML');
  }

  //Get a list items in the file
  const list = doc.getElementsByTagName('person');
  //! instead of geting all childrens of the container, we should get all tags from the container, it doens't matter how deep they are nested.
  //! Use CSS selector instead
  //? const list = doc.getElementsByTagName('list container)
  //? const items = list.querySelectorAll('person')

  for (let i = 0; i < list.length; i++) {
    if (matches.length >= maxResults) break;

    const person = list.item(i);
    if (!person) continue;

    const id = person.getAttribute('xml:id');
    if (!id) continue;

    const personName = person.getElementsByTagName('persName')[0];
    const nameChildren = personName?.children;
    if (nameChildren.length === 0) continue;

    // Compose name from its parts
    let name = '';
    for (let j = 0; j < nameChildren.length; j++) {
      name += nameChildren.item(j)?.textContent + ' ';
    }

    // Remove trailing whitespace and normalize
    name = name
      .trimEnd()
      .replaceAll(/(\r\n|\n|\r|\t)/gm, ' ')
      .replaceAll(/ +(?= )/g, '');

    // Check if name matches with the query
    // Matches here means if the query string is part of the persons name
    // It will match if the is anywhere in the name
    const match = name.includes(query);

    if (match) {
      matches.push({ label: name, uri: `${entityTypeUrl}#${id}` });
    }
  }

  // console.log(matches);

  return matches;
}
