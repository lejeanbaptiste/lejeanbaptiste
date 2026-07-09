class OctokitMock {
  readonly users = {
    getAuthenticated: async () => {
      throw new Error('Octokit mock not configured for getAuthenticated');
    },
    getByUsername: async () => {
      throw new Error('Octokit mock not configured for getByUsername');
    },
  };

  readonly rest = {
    repos: {
      listForAuthenticatedUser: async () => {
        throw new Error('Octokit mock not configured for listForAuthenticatedUser');
      },
      listForUser: async () => {
        throw new Error('Octokit mock not configured for listForUser');
      },
      get: async () => {
        throw new Error('Octokit mock not configured for get');
      },
      createForAuthenticatedUser: async () => {
        throw new Error('Octokit mock not configured for createForAuthenticatedUser');
      },
    },
  };

  constructor(_options?: unknown) {}
}

export const Octokit = OctokitMock;
