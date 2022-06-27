import axios from 'axios';
import { log } from './../../../utilities';
export default class Lgpn {
    axiosInstance;
    baseURL = 'https://lookup.services.cwrc.ca/lgpn2/cgi-bin';
    FORMAT = 'json';
    timeout = 3_000;
    constructor() {
        this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
    }
    async find({ query, type }) {
        if (type === 'person')
            return await this.callLGPN(query, 'person');
        if (type === 'place')
            return await this.callLGPN(query, 'place');
        throw new Error('Entity type invalid');
    }
    async callLGPN(query, type) {
        const encodedQuery = encodeURIComponent(query);
        // const urlQuery = `lgpn_search.cgi?name=${encodedQuery};style=${FORMAT}`;
        let urlQuery = `lgpn_search.cgi?`;
        urlQuery += `name=${encodedQuery}`;
        urlQuery += `;style=${this.FORMAT}`;
        const response = await this.axiosInstance.get(urlQuery).catch((error) => {
            return {
                status: 500,
                statusText: `The request exeeded the timeout (${this.timeout})`,
                data: undefined,
            };
        });
        if (response.status >= 400) {
            const errorMsg = `
        Something wrong with the call to LGPN, possibly a problem with the network or the server.
        HTTP error: ${response.statusText}
      `;
            log.warn(errorMsg);
            return [];
        }
        const data = response.data;
        if (!data)
            return [];
        //find the result object
        const start = data.indexOf('{');
        const end = data.lastIndexOf(');');
        const substr = data.substring(start, end);
        const dataObj = JSON.parse(substr);
        if (dataObj.persons.length === 0)
            return [];
        const results = dataObj.persons.map(({ id, name, place, notBefore, notAfter }) => {
            const description = `Place: ${place}<br/>Floruit: ${notBefore} to ${notAfter}`;
            return {
                description,
                id,
                name,
                repository: 'lgpn',
                uri: `https://www.lgpn.ox.ac.uk/id/${id}`,
                query,
                type,
            };
        });
        return results;
    }
}
//# sourceMappingURL=lgpn.js.map