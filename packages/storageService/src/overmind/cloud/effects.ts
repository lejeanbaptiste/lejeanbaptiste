import Provider, { ProviderAuth } from '../../@types/Provider';

type Providers = { [key: string]: Provider };

export class Api {
  providers: Providers = {};

  async initialize(providerAuth: ProviderAuth) {
    if (this.providers[providerAuth.name]) return;

    let module: any;

    if (providerAuth.name === 'github') module = await import('../../providers/Github');
    if (providerAuth.name === 'gitlab') module = await import('../../providers/Gitlab');

    if (!module) return;

    const Provider = module.default;
    const provider = new Provider(providerAuth);
    await provider.getAuthenticatedUser();

    this.providers[providerAuth.name] = provider;
  }
}

export const api = new Api();
