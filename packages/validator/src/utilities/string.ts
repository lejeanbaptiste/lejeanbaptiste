/**
 * Parses documentation string and returns the full name.
 * If the tag name is an abbreviation, we expect the full name
 * to be at the beginning of the documentation, in parentheses.
 *
 * @param {String} documentation The documentation string
 * @returns {String} The full name
 */
export const getFullNameFromDocumentation = (documentation: string = ''): string | undefined => {
  const hit = /^\((.*?)\)/.exec(documentation);
  if (hit === null) return;
  return hit[1];
};
