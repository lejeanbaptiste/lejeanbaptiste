import Fuse, { type IFuseOptions } from 'fuse.js';
import type {
  AuthorityLookupParams,
  AuthorityLookupResult,
  LocalAuthorityServiceConfig,
} from '../types';

interface Entity {
  description?: string;
  id: string;
  label: string;
}

const fuseOptions: IFuseOptions<Entity> = {
  includeScore: true,
  threshold: 0.6,
  keys: ['label'],
};

const fuse = new Fuse([], fuseOptions);

const DEFAULT_MAX_RESULTS = 10;

export async function teiFileBasedSearch({ query, entityType }: AuthorityLookupParams) {
  // @ts-ignore --  Typescript does not recognise `this` as variable (i.e., of 'any' type).
  // The context `this` must be assigned to the authority at the type it is setup.
  const serviceConfig = this as LocalAuthorityServiceConfig;
  //@ts-ignore -- Same as above
  if (!this) {
    throw new Error('No service config provided');
  }

  // Check if entity type is defined in the service config
  if (!serviceConfig.entityTypes.find((et) => et.name === entityType)) {
    throw new Error(`Entity type ${entityType} not found in service ${serviceConfig.id}`);
  }

  const entityTypeUrl = serviceConfig.entityTypes.find((et) => et.name === entityType)?.url;
  // Check if entity type url is defined in the service config
  if (!entityTypeUrl) {
    throw new Error(`Entity type ${entityType} not found in service ${serviceConfig.id}`);
  }

  const maxResults = serviceConfig.options?.maxResults ?? DEFAULT_MAX_RESULTS;

  //get file content
  const DATA = await fetch(entityTypeUrl).then((res) => res.text());

  const doc = new DOMParser().parseFromString(DATA, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error('Error parsing XML');
  }

  let entities: Entity[] = [];
  if (entityType === 'person') {
    entities = getPersons(doc.querySelectorAll('person'));
  } else if (entityType === 'place') {
    entities = getPlaces(doc.querySelectorAll('place'));
  } else if (entityType === 'organization') {
    entities = getOrganizations(doc.querySelectorAll('org'));
  } else if (entityType === 'work') {
    entities = getWorks(doc.querySelectorAll('bibl'));
  }

  // MATCH
  fuse.setCollection(entities);
  const fuseResults = fuse.search(query, { limit: maxResults });

  const results: AuthorityLookupResult[] = fuseResults.map(({ item }) => ({
    label: item.label,
    description: item.description,
    uri: `${entityTypeUrl}#${item.id}`,
  }));

  return results;
}

const getPersons = (list: NodeListOf<Element>) => {
  const persons: Entity[] = [];

  list.forEach((person) => {
    const id = person.getAttribute('xml:id');
    if (!id) return;

    const personName = person.querySelector('persName');
    if (!personName) return;

    let name = '';
    for (const child of personName.childNodes) {
      name += child.textContent + ' ';
    }

    name = name
      .trim()
      .replaceAll(/(\r\n|\n|\r|\t)/gm, ' ')
      .replaceAll(/ +(?= )/g, '');

    persons.push({ id, label: name });
  });

  return persons;
};

const getPlaces = (list: NodeListOf<Element>) => {
  const places: Entity[] = [];

  list.forEach((place) => {
    const id = place.getAttribute('xml:id');
    if (!id) return;

    const placeName = place.querySelector('placeName');
    if (!placeName) return;

    const name = (placeName.textContent ?? '')
      .trim()
      .replaceAll(/(\r\n|\n|\r|\t)/gm, ' ')
      .replaceAll(/ +(?= )/g, '');

    places.push({ id, label: name });
  });

  return places;
};

const getOrganizations = (list: NodeListOf<Element>) => {
  const organizations: Entity[] = [];

  list.forEach((organization) => {
    const id = organization.getAttribute('xml:id');
    if (!id) return;

    const orgName = organization.querySelector('orgName');
    if (!orgName) return;

    const name = (orgName.textContent ?? '')
      .trim()
      .replaceAll(/(\r\n|\n|\r|\t)/gm, ' ')
      .replaceAll(/ +(?= )/g, '');

    organizations.push({ id, label: name });
  });

  return organizations;
};

const getWorks = (list: NodeListOf<Element>) => {
  const works: Entity[] = [];

  list.forEach((work) => {
    const id = work.getAttribute('xml:id');
    if (!id) return;

    const workName = work.querySelector('title');
    if (!workName) return;

    const name = (workName.textContent ?? '')
      .trim()
      .replaceAll(/(\r\n|\n|\r|\t)/gm, ' ')
      .replaceAll(/ +(?= )/g, '');

    works.push({ id, label: name });
  });

  return works;
};
