import type { Authority, AuthorityService, LookUpResult } from '../../dialogs/entityLookups/types';
import { log } from './../../utilities';
import LookupServiceApi, { type LookUpFindProps } from './services/type';

type Sources = { [key: string]: LookupServiceApi };

class Api {
  private readonly services: Sources = {};
  private currentState: { [key: string]: AuthorityService };

  private nssi: LookupServiceApi | undefined;

  async initialize(
    authorities: { [key: string]: AuthorityService },
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

  async find({ query, type }: LookUpFindProps) {
    const results: Map<Authority, LookUpResult[]> = new Map();

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

  async useNssi({ query, type }: LookUpFindProps) {
    if (this.nssi) {
      const response = await this.nssi.find({ query, type });
      // log.info(response)
    }
  }
}

export const api = new Api();
