import axios, { type AxiosInstance } from 'axios';
import { type IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { type IFindParams } from './type';

type NamedEntityType = 'person' | 'place' | 'organization' | 'title';

export default class Cwrc implements ILookupServiceApi {
  private readonly axiosInstance: AxiosInstance;
  private readonly baseURL = '';
  private readonly LIMIT = 100;
  private readonly timeout = 3_000;

  cwrcProjectId = '';
  entityRoot = '';
  page = 0;
  projects: { [x: string]: any } = {};
  projectLogoRoot = '';
  searchRoot = '';

  constructor() {
    this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
  }

  setEntityRoot(url: string) {
    this.entityRoot = url;
  }
  getEntityRoot() {
    return this.entityRoot;
  }
  setSearchRoot(url: string) {
    this.searchRoot = url;
  }
  getSearchRoot() {
    return this.searchRoot;
  }

  async find({ query, type }: IFindParams) {
    if (type === 'person') return await this.callCWRC(query, 'person');
    if (type === 'place') return await this.callCWRC(query, 'place');
    if (type === 'organization') return await this.callCWRC(query, 'organization');
    if (type === 'title') return await this.callCWRC(query, 'title');

    throw new Error('Entity type invalid');
  }

  private async callCWRC(query: string, type: NamedEntityType) {
    const encodeURI = encodeURIComponent(query);
    // const urlQuery = `${searchRoot}/search/${type}?query=${encodeURI}&limit=${LIMIT}&page=${page}`;

    const params = new URLSearchParams({
      query: encodeURI,
      limit: this.LIMIT.toString(),
      page: this.page.toString(),
    });

    const urlQuery = `${this.searchRoot}/search/${type}?${params}`;

    const response = await this.axiosInstance.get(urlQuery);

    if (response.status >= 400) {
      const errorMsg = `
        Something wrong with the call to CWRC, possibly a problem with the network or the server.
        HTTP error: ${response.statusText}
      `;
      throw new Error(errorMsg);
    }

    if (!response.data.response.objects) return [];

    const result: IResult[] = response.data.response.objects.map(
      ({ PID, object_label }: { PID: string; object_label: string }) => {
        const id = PID;
        const name = object_label;
        const uri = `${this.entityRoot}/${id}`;

        const namespace = id.substring(0, id.indexOf(':'));
        const logo = this.projects[namespace];

        const data = {
          id,
          name,
          logo: logo ? `${this.projectLogoRoot}/${logo}` : undefined,
          repository: 'CWRC',
          query,
          type,
          uri,
        };

        return data;
      }
    );

    return result;
  }

  /**
   * Set all the properties necessary for the project lookup, then perform the lookup
   * @param {Object} config
   * @param {String} projectLogoRoot The root directory that project logos are located in
   * @param {String} projectLookupUrl The actual url for the lookup
   * @param {String} cwrcProjectId The ID assigned to the CWRC Commons project
   * @returns {Object} The projects (namespace and logo)
   */
  async setProjectLookupConfig(config: {
    cwrcProjectId: string;
    projectLogoRoot: string;
    projectLookupUrl: string;
  }) {
    this.projectLogoRoot = config.projectLogoRoot;
    this.cwrcProjectId = config.cwrcProjectId;
    return await this.doProjectLookup(config.projectLookupUrl);
  }

  doProjectLookup = async (url: string) => {
    const response = await this.axiosInstance
      .get(url, {
        headers: { credentials: 'same-origin' },
      })
      .catch((error) => {
        return {
          status: 500,
          statusText: `The request exeeded the timeout (${this.timeout})`,
          data: undefined,
        };
      });

    if (response.status >= 400) {
      const errorMsg = `
      Something wrong with the call to CWRC, possibly a problem with the network or the server.
      HTTP error: ${response.statusText}
    `;
      throw new Error(errorMsg);
    }

    this.projects = this.parseProjectsData(response);
    return this.projects;
  };

  private parseProjectsData(data: { [x: string]: any }) {
    const parsedProjects: { [x: string]: any } = {};

    for (let projectKey in data) {
      const project = data[projectKey];

      let logoFilename;
      const fieldLogo = project.field_logo;
      if (fieldLogo !== undefined) {
        for (let key in fieldLogo) {
          const entry = fieldLogo[key];
          if (entry.length > 0) logoFilename = entry[0].filename;
        }
      }

      let projectId;
      const fieldTopLevel = project.field_top_level_collection;
      if (fieldTopLevel !== undefined && fieldTopLevel.und !== undefined) {
        const und = fieldTopLevel.und;
        if (und.length > 0 && und[0].pid) {
          const pid = und[0].pid;
          const namespace =
            pid === this.cwrcProjectId ? 'cwrc' : pid.substring(0, pid.indexOf(':'));
          if (namespace !== '') projectId = namespace;
        }
      }

      if (logoFilename && projectId) {
        if (!parsedProjects[projectId]) {
          parsedProjects[projectId] = logoFilename;
        }
      }
    }
    return parsedProjects;
  }
}
