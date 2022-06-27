import axios from 'axios';
import { log } from './../../../utilities';
export default class Dbpedia {
    axiosInstance;
    baseURL = 'https://lookup.dbpedia.org/api/search';
    FORMAT = 'json';
    MAX_HITS = 25; // default: 100; but it breaks at 45+
    timeout = 3_000;
    constructor() {
        this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
    }
    async find({ query, type }) {
        if (type === 'person')
            return await this.callDBPedia(query, 'person');
        if (type === 'place')
            return await this.callDBPedia(query, 'place');
        if (type === 'organization')
            return await this.callDBPedia(query, 'organisation');
        if (type === 'title')
            return await this.callDBPedia(query, 'work');
        if (type === 'rs')
            return await this.callDBPedia(query, 'thing');
        throw new Error('Entity type invalid');
    }
    async callDBPedia(query, type) {
        const encodeQueryString = encodeURIComponent(query);
        const params = new URLSearchParams({
            QueryClass: type,
            QueryString: encodeQueryString,
            format: this.FORMAT,
            MaxHits: this.MAX_HITS.toString(),
        });
        const urlQuery = `KeywordSearch?$${params}`;
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
        if (!data)
            return [];
        // const mapResponse = responseJson.docs.map(
        const results = data.docs.map(({ comment, label, resource }) => {
            //? assuming first instance of description, name and uri;
            const description = comment?.[0] ?? 'No description available';
            const name = label[0].replace(/(<([^>]+)>)/gi, '');
            const uri = resource[0];
            return { description, id: uri, name, repository: 'dbpedia', query, type, uri };
        });
        return results;
    }
}
//# sourceMappingURL=dbpedia.js.map