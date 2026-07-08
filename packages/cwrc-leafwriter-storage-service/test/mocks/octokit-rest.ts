export class Octokit {
  users = {
    getAuthenticated: async () => ({ data: { login: 'test-user', id: 1 } }),
    getByUsername: async ({ username }: { username: string }) => ({
      data: { login: username, id: 1 },
    }),
  };

  repos = {
    listForUser: async () => ({ data: [], headers: {} }),
    createForAuthenticatedUser: async ({ name }: { name: string }) => ({
      data: {
        default_branch: 'main',
        id: 1,
        name,
        owner: { login: 'test-user' },
        permissions: { push: true },
      },
    }),
    getBranch: async () => ({
      data: {
        commit: {
          commit: {
            tree: { sha: 'tree-sha' },
          },
        },
      },
    }),
  };

  rest = {
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
      listForAuthenticatedUser: async () => ({ data: [], headers: {} }),
      get: async () => ({
        data: {
          id: 1,
          name: 'repo',
          owner: { login: 'test-user' },
          permissions: { push: true },
        },
      }),
      createForAuthenticatedUser: async ({ name }: { name: string }) => ({
        data: {
          default_branch: 'main',
          id: 1,
          name,
          owner: { login: 'test-user' },
          permissions: { push: true },
        },
      }),
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
}
