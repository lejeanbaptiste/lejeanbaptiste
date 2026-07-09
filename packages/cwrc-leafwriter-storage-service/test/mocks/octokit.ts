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
    git: {
      getTree: async () => ({
        data: {
          truncated: false,
          tree: [
            { path: 'folder1', type: 'tree' },
            { path: 'folder1/language.xml', type: 'blob' },
            { path: 'language.xml', type: 'blob' },
          ],
        },
      }),
    },
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
      getBranch: async () => ({
        data: {
          commit: {
            commit: {
              tree: { sha: 'tree-sha' },
            },
          },
        },
      }),
    },
  };

  constructor(_options?: unknown) {}
}

export const Octokit = OctokitMock;
