class Api {
    services = {};
    currentState;
    nssi;
    async initialize(authorities, { token }) {
        this.currentState = authorities;
        for (const [authority, authorityService] of Object.entries(authorities)) {
            if (this.services[authority])
                return;
            const module = await import(`./services/${authority}`);
            if (!module)
                return;
            const Service = module.default;
            const source = new Service(authorityService.config);
            this.services[authority] = source;
        }
    }
    async find({ query, type }) {
        const results = new Map();
        const listPriority = new Map([...Object.entries(this.currentState)].sort(([, serviceA], [, serviceB]) => serviceA.priority - serviceB.priority));
        await Promise.all([...listPriority.entries()].map(async ([, { enabled, id, entities }]) => {
            if (!enabled)
                return;
            if (!entities[type])
                return;
            results.set(id, []); //* guarantee the order
            const response = await this.services[id].find({ query, type });
            results.set(id, response);
        }));
        if (this.nssi)
            this.useNssi({ query, type });
        return results;
    }
    async useNssi({ query, type }) {
        if (this.nssi) {
            const response = await this.nssi.find({ query, type });
            // log.info(response)
        }
    }
}
export const api = new Api();
//# sourceMappingURL=effects.js.map