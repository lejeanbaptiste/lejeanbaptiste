import axios from 'axios';
import wdk from 'wikidata-sdk';
import { log } from './../../../utilities';
export default class Wikidata {
    axiosInstance;
    baseURL = '';
    FORMAT = 'json';
    // private readonly MAX_HITS = 20; //defaut: 20
    LANGUAGE = 'en';
    timeout = 3_000;
    constructor() {
        this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
    }
    async find({ query, type }) {
        if (type === 'person')
            return await this.callWikidata(query, 'person');
        if (type === 'place')
            return await this.callWikidata(query, 'place');
        if (type === 'organization')
            return await this.callWikidata(query, 'org');
        if (type === 'title')
            return await this.callWikidata(query, 'title');
        if (type === 'rs')
            return await this.callWikidata(query, 'rs');
        throw new Error('Entity type invalid');
    }
    async callWikidata(query, type) {
        const url = wdk.searchEntities({
            search: query,
            format: this.FORMAT,
            language: this.LANGUAGE,
            // limit: MAX_HITS,
        });
        const response = await this.axiosInstance.get(url).catch((error) => {
            return {
                status: 500,
                statusText: `The request exeeded the timeout (${this.timeout})`,
                data: undefined,
            };
        });
        if (response.status >= 400) {
            const errorMsg = `
        Something wrong with the call to Wikidata, possibly a problem with the network or the server.
        HTTP error: ${response.statusText}
      `;
            log.warn(errorMsg);
            return [];
        }
        const data = response.data;
        if (!data)
            return [];
        const results = data.search.map(({ concepturi, label, description }) => {
            return {
                description,
                id: concepturi,
                name: label,
                repository: 'wikidata',
                query,
                type,
                uri: concepturi,
            };
        });
        return results;
    }
}
//# sourceMappingURL=wikidata.js.map