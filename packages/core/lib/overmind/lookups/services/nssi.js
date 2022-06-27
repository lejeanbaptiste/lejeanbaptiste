import axios from 'axios';
export default class Nssi {
    axiosInstance;
    baseURL = 'https://api.nssi.dev.lincsproject.ca/api/';
    timeout = 3_000;
    token;
    constructor(config) {
        if (!config.token || config.token === '') {
            throw new Error('You must have a NSSI token to make requests to Geonames');
        }
        this.token = config.token;
        this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
    }
    async find({ query, type }) {
        return [];
        // // log.info(this.token)
        // // const response = await fetch({
        // //   url:'https://api.nssi.dev.lincsproject.ca/api/jobs',
        // // })
        // const response = await this.axiosInstance.post(
        //   '/jobs',
        //   {
        //     projectName: 'Sample Lettter',
        //     format: 'text/plain',
        //     document: query,
        //     workflow: 'stanford_ner_full',
        //     authorities: ['VIAF', 'WIKIDATA', 'GEONAMES'],
        //     // context: {
        //     //   ORGANIZATION_TAG: 'orgName',
        //     //   LOCATION_TAG: 'placeName',
        //     //   PERSON_TAG: 'persName',
        //     //   TITLE_TAG: 'title',
        //     // },
        //   },
        //   {
        //     headers: {
        //       'Content-Type': 'application/json',
        //       Authorization: `Bearer ${this.token}`,
        //     },
        //   }
        // );
        // log.info(response);
        // if (response.status >= 400) {
        //   const errorMsg = `
        //     Something wrong with the call to NSSI, possibly a problem with the network or the server.
        //     HTTP error: ${response.statusText}
        //   `;
        //   // throw new Error(errorMsg);
        //   log.warn(errorMsg);
        //   return [];
        // }
        // const data = response.data;
        // log.info(data);
        // return [];
    }
}
//# sourceMappingURL=nssi.js.map