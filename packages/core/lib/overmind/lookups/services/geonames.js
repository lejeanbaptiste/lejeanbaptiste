import axios from 'axios';
import { log } from './../../../utilities';
export default class Geonames {
    axiosInstance;
    baseURL = 'https://secure.geonames.org';
    MAX_HITS = 25; // default: 100;
    timeout = 3_000;
    username;
    constructor(config) {
        if (!config?.username || config?.username === '') {
            // throw new Error('You must define a username to be able to make requests to Geonames');
            log.warn('GEONAME: You must define a username to be able to make requests to Geonames');
            return;
        }
        this.username = config.username;
        this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
    }
    async find({ query }) {
        return await this.callGeonames(query);
    }
    async callGeonames(query) {
        const encodedURI = encodeURIComponent(query);
        const params = new URLSearchParams({
            q: encodedURI,
            username: this.username,
            maxRows: this.MAX_HITS.toString(),
        });
        const urlQuery = `searchJSON?$${params}`;
        const response = await this.axiosInstance.get(urlQuery).catch((error) => {
            return {
                status: 500,
                statusText: `The request exeeded the timeout (${this.timeout})`,
                data: undefined,
            };
        });
        if (response.status >= 400) {
            const errorMsg = `
        Something wrong with the call to geonames, possibly a problem with the network or the server.
        HTTP error: ${response.statusText}
      `;
            log.warn(errorMsg);
            return [];
        }
        const data = response.data;
        if (!data)
            return [];
        const results = data.geonames.map(({ toponymName, adminName1, countryName, geonameId, fcodeName }) => {
            const state = adminName1 ?? '';
            const description = fcodeName ?? '';
            const name = `${toponymName} ${state} ${countryName ?? ''}`;
            const uri = `https://geonames.org/${geonameId}`;
            return { description, id: uri, name, repository: 'geonames', type: 'place', query, uri };
        });
        return results;
    }
}
//# sourceMappingURL=geonames.js.map