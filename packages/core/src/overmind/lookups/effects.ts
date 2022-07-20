import type { Authority, IAuthorityService, IResult } from '../../components/entityLookups/types';
import { log } from './../../utilities';
import ILookupServiceApi, { type IFindParams } from './services/type';

type Sources = { [key: string]: ILookupServiceApi };

class Api {
  private readonly services: Sources = {};
  private currentState: { [key: string]: IAuthorityService };

  private nssi: ILookupServiceApi | undefined;

  async initialize(
    authorities: { [key: string]: IAuthorityService },
    { token }: { token?: string }
  ) {
    this.currentState = authorities;

    for (const [authority, authorityService] of Object.entries(authorities)) {
      if (this.services[authority]) return;

      const module = await import(`./services/${authority}`);
      if (!module) return;

      const Service = module.default;
      const source = new Service(authorityService.config);

      this.services[authority] = source;
    }
  }

  async find({ query, type }: IFindParams) {
    const results: Map<Authority, IResult[]> = new Map();

    const listPriority = new Map(
      [...Object.entries(this.currentState)].sort(
        ([, serviceA], [, serviceB]) => serviceA.priority - serviceB.priority
      )
    );

    await Promise.all(
      [...listPriority.entries()].map(async ([, { enabled, id, entities }]) => {
        if (!enabled) return;
        if (!entities[type]) return;
        results.set(id, []); //* guarantee the order
        const response = await this.services[id].find({ query, type });
        results.set(id, response);
      })
    );

    if (this.nssi) this.useNssi({ query, type });

    return results;
  }

  async useNssi({ query, type }: IFindParams) {
    if (this.nssi) {
      const response = await this.nssi.find({ query, type });
      // log.info(response)
    }
  }
}

export const api = new Api();
