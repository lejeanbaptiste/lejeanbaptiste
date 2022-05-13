export type AuthenticateProp = {
  access_token?: string;
  IDPTokens?: string | any;
  providerName?: string;
  userId?: string;
  userName?: Readonly<string>;
};

export interface IdentityProvider {
  name: string;
  authenticate(params: AuthenticateProp): void;
  getAccessToken: () => string;
  getAuthenticatedUser(userId?: string): any;
  getUserId: () => string;
  getUserName: () => string;
}
