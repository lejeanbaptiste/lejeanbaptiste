import { AuthorityServiceConfig } from '../../cwrc-leafwriter/src/types';

export const customAuthority: AuthorityServiceConfig = {
  name: 'Custom Authority Service',
  description: 'An example for a custom entity lookup service for LEAF-Writer',
  author: { name: 'CWRC Team', url: 'https://www.cwrc.ca/' },
  entityTypes: ['person', 'place', 'organization', 'work', 'thing'],
  // url: '',
  search: async ({ query, entityType }) => {
    //1. validate and route entityType

    //2. Fetch and validate the response

    //3. Parse the response and return the results

    return [];
  },
};
