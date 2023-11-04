module.exports = {
  format: '{type}{scope}: {emoji}{subject}',
  maxMessageLength: 110,
  path: 'git-cz',
  questions: ['scope', 'type', 'subject', 'body', 'breaking', 'issues'],
  scopes: ['root', 'commons', 'leafwriter', 'storage service', 'validator', 'eslint', 'tsconfig'],
};
