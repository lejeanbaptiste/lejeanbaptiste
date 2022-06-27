import axios from 'axios';
import { log } from './../../../utilities';
export default class Viaf {
    axiosInstance;
    baseURL = 'https://viaf.org/viaf';
    FORMAT = 'application/json';
    // private readonly MAX_HITS = 10; //default: 10
    timeout = 3_000;
    constructor() {
        this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
    }
    async find({ query, type }) {
        if (type === 'person')
            return await this.callVIAF(query, 'personalNames');
        if (type === 'place')
            return await this.callVIAF(query, 'geographicNames');
        if (type === 'organization')
            return await this.callVIAF(query, 'corporateNames');
        if (type === 'title')
            return await this.callVIAF(query, 'uniformTitleWorks');
        if (type === 'rs')
            return await this.callVIAF(query, 'names');
        throw new Error('Entity type invalid');
    }
    async callVIAF(query, methodName) {
        const encodedUri = encodeURIComponent(query);
        let urlQuery = 'search?';
        urlQuery += `query=local.${methodName}+all+%22${encodedUri}%22`;
        urlQuery += `&httpAccept=${this.FORMAT}`;
        // urlQuery += `&maximumRecords=${MAX_HITS}`;
        const response = await this.axiosInstance.get(urlQuery).catch((error) => {
            return {
                status: 500,
                statusText: `The request exeeded the timeout (${this.timeout})`,
                data: undefined,
            };
        });
        if (response.status >= 400) {
            const errorMsg = `
        Something wrong with the call to DBPedia, possibly a problem with the network or the server.
        HTTP error: ${response.statusText}
      `;
            log.warn(errorMsg);
            return [];
        }
        const data = response.data;
        if (!data.searchRetrieveResponse.records)
            return [];
        const results = data.searchRetrieveResponse.records.map((entry) => {
            const { nameType, Document, mainHeadings } = entry.record.recordData;
            const uri = Document['@about'];
            //? Assumes the first instance of mainHeading
            const name = Array.isArray(mainHeadings.data)
                ? mainHeadings.data[0].text
                : mainHeadings.data.text;
            return { id: uri, name, repository: 'viaf', query, type: nameType, uri };
        });
        return results;
    }
}
//# sourceMappingURL=viaf.js.map