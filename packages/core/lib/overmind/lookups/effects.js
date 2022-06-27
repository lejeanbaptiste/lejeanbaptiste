class Api {
    services = {};
    currentState = {};
    nssi;
    async initialize(authorities, { token }) {
        this.currentState = authorities;
        for (const authority of Object.values(authorities)) {
            if (this.services[authority.id])
                return;
            const module = await import(`./services/${authority.id}`);
            if (!module)
                return;
            const Service = module.default;
            const source = new Service(authority.config);
            this.services[authority.id] = source;
        }
        if (token) {
            const module = await import(`./services/nssi`);
            if (!module)
                return;
            const Service = module.default;
            const source = new Service({ token });
            this.nssi = source;
        }
    }
    async find({ query, type }) {
        const results = new Map();
        const listPriority = Object.values(this.currentState).sort((a, b) => a.priority - b.priority);
        await Promise.all(listPriority.map(async ({ enabled, id, entities }) => {
            if (!enabled)
                return;
            if (!entities[type]?.enabled)
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