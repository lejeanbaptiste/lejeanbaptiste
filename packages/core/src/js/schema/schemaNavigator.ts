import { log } from '../../utilities';

/**
 * Navigates the schema JSON to get parents, children, and attributes for tags or paths.
 * Paths are essentially XPaths, however only element names and the child axis "/" are supported, e.g. TEI/text/body/div/p
 */

let schemaJSON: any;
let schemaElements: any;

export const setSchemaJSON = (json: any) => {
  schemaJSON = json;
};

export const setSchemaElements = (elements: any) => {
  schemaElements = elements;
};

/**
 * Returns an array of valid parents for a particular tag
 * @param {String} tag The element name
 * @returns {Array}
 */
export const getParentsForTag = (tag: string) => {
  const elements = getEntriesForTag(tag);

  if (elements.length == 0) {
    log.warn(`schemaNavigator: cannot find element for ${tag}`);
    return [];
  }

  let parents: { name: string; level: number }[] = [];
  for (let i = 0; i < elements.length; i++) {
    parents = [...parents, ...getElementParents(elements[i])];
  }

  sortEntries(parents);
  return parents;
};

/**
 * Returns an array of valid parents for a particular path
 * @param {String} path The path
 * @returns {Array}
 */
export const getParentsForPath = (path: string) => {
  const element = getEntryForPath(path);
  if (element === null) {
    log.warn(`schemaNavigator: cannot find element for ${path}`);
    return [];
  }

  const parents = getElementParents(element);
  sortEntries(parents);

  return parents;
};

/**
 * Returns an array of valid children for a particular tag
 * @param {String} tag The element name
 * @returns {Array}
 */
export const getChildrenForTag = (tag: string) => {
  const elements = getEntriesForTag(tag);

  if (elements.length == 0) {
    log.warn(`schemaNavigator: cannot find element for ${tag}`);
    return [];
  }

  let children: any[] = [];
  for (let i = 0; i < elements.length; i++) {
    children = [...children, ...getElementChildren(elements[i], 'element')];
  }

  sortEntries(children);
  return children;
};

/**
 * Returns an array of valid children for a particular path
 * @param {String} path The path
 * @returns {Array}
 */
export const getChildrenForPath = (path: string) => {
  const element = getEntryForPath(path);
  if (element === null) {
    log.warn(`schemaNavigator: cannot find element for ${path}`);
    return [];
  }

  const children = getElementChildren(element, 'element');
  sortEntries(children);
  return children;
};

/**
 * Returns an array of valid attributes for a particular tag
 * @param {String} tag The element name
 * @returns {Array}
 */
export const getAttributesForTag = (tag: string) => {
  const elements = getEntriesForTag(tag);
  if (elements.length === 0) {
    // log.warn('schemaNavigator: cannot find element for '+tag);
    return [];
  }

  const children = elements.flatMap((element) => getElementChildren(element, 'attribute'));
  sortEntries(children);
  return children;
};

/**
 * Returns an array of valid attributes for a particular path
 * @param {String} path The path
 * @returns {Array}
 */
export const getAttributesForPath = (path: string) => {
  const element = getEntryForPath(path);
  if (element === null) {
    log.warn(`schemaNavigator: cannot find element for ${path}`);
    return [];
  }

  const children = getElementChildren(element, 'attribute');
  sortEntries(children);
  return children;
};

/**
 * Get the schema entries for a tag
 * @param {String} name The element name
 * @returns {Array}
 */
const getEntriesForTag = (name: string) => {
  const matches: any[] = [];
  queryDown(schemaJSON.grammar, (item: any) => {
    if (item.$key === 'element' && item['@name'] === name) {
      matches.push(item);
    }
  });
  return matches;
};

/**
 * Uses a path to find the related entry in the schema.
 * @param {String} path A forward slash delimited pseudo-xpath
 * @returns {Object}
 */
const getEntryForPath = (path: string) => {
  let context = schemaJSON.grammar;
  let match = null;
  const tags = path.split('/');

  for (let i = 0; i < tags.length; i++) {
    let tag = tags[i];
    if (!tag) return;
    if (tag !== '') {
      tag = tag.replace(/\[\d+\]$/, ''); // remove any indexing
      queryDown(
        context,
        (item: any) => {
          if (item['@name'] && item['@name'] === tag) {
            context = item;

            if (i === tags.length - 1) {
              if (item.$key === 'element') {
                match = item;
                return false;
              } else {
                // the name matches but we're in define so drill down further
                context = item;
              }
            }
            return true;
          }
        },
        true
      );
    }
  }
  return match;
};

/**
 * Returns all the valid parents of an element schema entry
 * @param {Object} el The schema entry
 * @returns {Array}
 */
const getElementParents = (el: any) => {
  const parents: { name: string; level: number }[] = [];

  let parent = el.$parent;
  while (parent !== undefined) {
    if (parent.$key === 'define' || parent.$key === 'element') {
      break;
    } else {
      parent = parent.$parent;
    }
  }

  if (parent.$key === 'define') {
    getParentsJSON(parent['@name'], {}, 0, parents);
  } else if (parent.$key === 'element') {
    parents.push({ name: parent['@name'], level: 0 });
  }

  return parents;
};

/**
 * Returns all the valid element or attribute children of an element schema entry
 * @param {Object} element The schema entry
 * @param {String} type Either "element" or "attribute"
 * @returns {Array}
 */
const getElementChildren = (element: any, type: string) => {
  let children: any[] = [];

  getChildrenJSON(element, {}, 0, type, children);

  if (children.indexOf('anyName') !== -1) {
    children = [];
    // anyName means include all elements
    for (let i = 0; i < schemaElements.length; i++) {
      const el = schemaElements[i];
      // TODO need to add more info than just the name
      children.push({ name: el });
    }
  }

  return children;
};

/**
 * Sort the schema entries by name in ascending order
 * @param {Array} entries An array of schema entries
 */
const sortEntries = (entries: any[]) => {
  entries.sort((a: any, b: any) => {
    if (a.name > b.name) return 1;
    if (a.name < b.name) return -1;
    return 0;
  });
};

/**
 * Navigate the schema json to find all the parents for a schema definition name.
 * @param {String} defName The name of the schema definition entry
 * @param {Object} defHits A map to track what schema definitions have already been visited
 * @param {Integer} level Tracks the current tree depth
 * @param {Array} parents An array to store the results
 */
const getParentsJSON = (defName: string, defHits: any, level: number, parents: any[]) => {
  const context = schemaJSON.grammar;
  const matches: any[] = [];

  queryDown(context, (item: any) => {
    if (item.$key === 'ref' && item['@name'] === defName) {
      matches.push(item);
    }
  });

  for (let i = 0; i < matches.length; i++) {
    const item = matches[i];
    let parent = item.$parent;

    while (parent !== undefined) {
      if (parent.$key === 'element' || parent.$key === 'define') {
        break;
      } else {
        parent = parent.$parent;
      }
    }

    if (parent.$key === 'element') {
      let docs = null;
      queryDown(parent, (item: any) => {
        if (item['a:documentation']) {
          docs = item['a:documentation'];
          return false;
        }
      });

      if (docs?.['#text'] !== undefined) {
        docs = docs['#text'];
      } else if (docs === null) {
        docs = '';
      }
      const fullName = getFullNameFromDocumentation(docs);

      parents.push({
        name: parent['@name'],
        fullName,
        level,
        documentation: docs,
      });
    } else {
      if (!defHits[parent['@name']]) {
        defHits[parent['@name']] = true;
        getParentsJSON(parent['@name'], defHits, level + 1, parents);
      }
    }
  }
};

/**
 * Navigate the schema json to find all the children for a schema entry
 * @param {Object} currEl The schema entry element that's currently being processed
 * @param {Object} defHits A map of define tags that have already been processed
 * @param {Integer} level The level of recursion
 * @param {String} type The type of child to search for (element or attribute)
 * @param {Array} children The children to return
 * @param {Object} refParentProps For storing properties of a ref's parent (e.g. optional), if we're processing the ref's definition
 */
const getChildrenJSON = (
  currEl: any,
  defHits: any,
  level: number,
  type: string,
  children: any[],
  refParentProps?: any
) => {
  // first get the direct types
  let hits: any[] = [];

  queryDown(currEl, (item: any) => {
    if (item.$key === 'element' && item !== currEl) return false; // we're inside a different element so stop querying down

    if (item[type] != null) {
      hits = [...hits, item[type]]; // use concat incase item[type] is an array
    }
  });

  for (let i = 0; i < hits.length; i++) {
    const child = hits[i];

    let docs = null;
    queryDown(child, (item: any) => {
      if (item['a:documentation']) {
        docs = item['a:documentation'];
        return false;
      }
    });

    if (docs?.['#text'] !== undefined) {
      docs = docs['#text'];
    } else if (docs == null) {
      docs = '';
    }
    const fullName = getFullNameFromDocumentation(docs);

    if (child.anyName) {
      children.push('anyName');
      return;
    }

    let duplicate = false;

    children.every((entry, index, array) => {
      if (entry.name === child['@name']) {
        duplicate = true;
        return false;
      }
      return true;
    });

    if (!duplicate) {
      const childObj = {
        name: child['@name'],
        fullName: fullName,
        level: level + 0,
        documentation: docs,
      };

      if (type === 'element') {
        if (refParentProps?.optional != null) {
          //@ts-ignore
          childObj.required = !refParentProps.optional;
        } else {
          if (child.$parent.$key === 'element' || child.$parent.$key === 'oneOrMore') {
            //@ts-ignore
            childObj.required = true;
          } else {
            //@ts-ignore
            childObj.required = false;
          }
        }
      } else if (type === 'attribute') {
        if (refParentProps?.optional != null) {
          //@ts-ignore
          childObj.required = !refParentProps.optional;
        } else {
          //@ts-ignore
          childObj.required = true;
          queryUp(child.$parent, (item: any) => {
            if (item.optional) {
              //@ts-ignore
              childObj.required = false;
              return false;
            }
          });
        }

        let defaultVal = null;
        queryDown(child, (item: any) => {
          if (item['@a:defaultValue']) {
            defaultVal = item['@a:defaultValue'];
            return false;
          }
        });

        //@ts-ignore
        childObj.defaultValue = defaultVal || '';

        let choice: any = null;
        let list: any = null;
        queryDown(child, (item: any) => {
          if (item.choice) choice = item.choice;
          if (item.list) list = item.list;
          if (choice !== null && list !== null) return false;
        });

        if (choice !== null) {
          const choices = [];
          let values: any = [];

          queryDown(choice, (item: any) => {
            if (item.value) values = item.value;
            if (!Array.isArray(values)) values = [values];
          });

          for (let j = 0; j < values.length; j++) {
            let val = values[j];
            if (val['#text']) val = val['#text'];
            choices.push(val);
          }

          //@ts-ignore
          childObj.choices = choices;
        }

        if (list !== null) {
          // TODO
        }

        // TODO process data pattern using pcre-to-regexp
      }
      children.push(childObj);
    }
  }

  // now process the references
  hits = [];
  queryDown(currEl, (item: any) => {
    if (item.$key === 'element' && item !== currEl) return false; // we're inside a different element so stop querying down
    if (item.ref) hits = hits.concat(item.ref); // use concat incase item.ref is an array
  });

  for (let i = 0; i < hits.length; i++) {
    const ref = hits[i];
    const name = ref['@name'];

    // store optional value
    let optional = null;
    queryUp(ref, (item: any) => {
      if (item.$parent?.$key) {
        const parentKey = item.$parent.$key;
        if (parentKey === 'choice' || parentKey === 'optional' || parentKey === 'zeroOrMore') {
          // we're taking choice to mean optional, even though it could mean a requirement to choose one or more elements
          optional = true;
          return false;
        } else if (parentKey === 'oneOrMore') {
          optional = false;
          return false;
        }
      }
      return false;
    });

    if (!defHits[name]) {
      defHits[name] = true;
      const def = getDefinition(name);
      if (def !== null) {
        getChildrenJSON(def, defHits, level + 1, type, children, { optional: optional });
      }
    }
  }
};

/**
 * Moves up the schema JSON "tree", call the passed function on each entry.
 * Function should return false to stop moving up.
 * @param {Object} context A schema entry, the starting point.
 * @param {Function} matchingFunc The function that's called on each entry.
 */
const queryUp = (context: any, matchingFunc: Function) => {
  let continueQuery = true;
  while (continueQuery && context !== null) {
    continueQuery = matchingFunc.call(this, context);
    if (continueQuery === undefined) continueQuery = true;
    context = context.$parent;
  }
};

/**
 * Moves recursively down the schema JSON "tree", calling the passed function on each entry.
 * Function should return false to stop the recursion.
 * @param {Object} context A schema entry, the starting point.
 * @param {Function} matchingFunc The function that's called on each entry.
 * @param {Boolean} [processRefs] Automatically process refs, i.e. fetch their definitions
 */
const queryDown = (context: any, matchingFunc: Function, processRefs = false) => {
  let continueQuery = true;
  const defHits = {};

  const isArray = (obj: any) => toString.apply(obj) === '[object Array]';
  const isObject = (obj: any) => {
    return !!obj && Object.prototype.toString.call(obj) === '[object Object]';
  };

  function doQuery(currContext: any) {
    if (!continueQuery) return;

    //@ts-ignore
    continueQuery = matchingFunc.call(this, currContext);
    if (continueQuery == undefined) continueQuery = true;

    for (const key in currContext) {
      // filter out metadata and attributes // * key.search innequaliy needs coercion: don't use !==
      if (key !== '$parent' && key !== '$key' && key.search('@') != 0) {
        const prop = currContext[key];

        if (processRefs === true && key === 'ref') {
          const refs = isArray(prop) ? prop : [prop];

          // eslint-disable-next-line no-unused-vars
          const defs = [];
          for (let j = 0; j < refs.length; j++) {
            const name = refs[j]['@name'];
            //@ts-ignore
            if (defHits[name] === undefined) {
              //@ts-ignore
              defHits[name] = true;
              const def = getDefinition(name);
              if (def !== null) doQuery(def);
            }
          }
        } else {
          if (isArray(prop)) {
            for (let i = 0; i < prop.length; i++) {
              doQuery(prop[i]);
            }
          } else if (isObject(prop)) {
            doQuery(prop);
          }
        }
      }
    }
  }

  doQuery(context);
};

// /**
//  * Moves recursively down the schema JSON "tree", calling the passed function on each entry.
//  * Function should return false to stop the recursion.
//  * @param {Object} context A schema entry, the starting point.
//  * @param {Function} matchingFunc The function that's called on each entry.
//  * @param {Boolean} [processRefs] Automatically process refs, i.e. fetch their definitions
//  */
//  const queryDown = (context: any, matchingFunc: Function, processRefs = false) => {
//   var continueQuery = true;

//     var defHits = {};

//     function isArray(obj) {
//       return toString.apply(obj) === '[object Array]';
//     }
//     function isObject(obj) {
//       return !!obj && Object.prototype.toString.call(obj) === '[object Object]';
//     }

//     function doQuery(currContext) {
//       if (continueQuery) {
//         continueQuery = matchingFunc.call(this, currContext);
//         if (continueQuery == undefined) continueQuery = true;
//         for (var key in currContext) {
//           // filter out metadata and attributes
//           if (key != '$parent' && key != '$key' && key.search('@') != 0) {
//             var prop = currContext[key];

//             if (processRefs === true && key === 'ref') {
//               var refs;
//               if (isArray(prop)) {
//                 refs = prop;
//               } else {
//                 refs = [prop];
//               }
//               // eslint-disable-next-line no-unused-vars
//               var defs = [];
//               for (var j = 0; j < refs.length; j++) {
//                 var name = refs[j]['@name'];
//                 if (defHits[name] === undefined) {
//                   defHits[name] = true;
//                   var def = _getDefinition(name);
//                   if (def !== null) {
//                     doQuery(def);
//                   }
//                 }
//               }
//             } else {
//               if (isArray(prop)) {
//                 for (var i = 0; i < prop.length; i++) {
//                   doQuery(prop[i]);
//                 }
//               } else if (isObject(prop)) {
//                 doQuery(prop);
//               }
//             }
//           }
//         }
//       } else {
//         return;
//       }
//     }

//     doQuery(context);
// };

/**
 * Gets the schema definition for a specified name
 * @param {String} name The name
 * @returns {Object|Null}
 */
const getDefinition = (name: string) => {
  const defs = schemaJSON.grammar.define;
  for (let i = 0, len = defs.length; i < len; i++) {
    const d = defs[i];
    if (d['@name'] == name) return d;
  }

  log.warn('schemaNavigator: no definition found for', name);
  return null;
};

/**
 * Parses the passed documentation string and returns the full name.
 * If the tag name is an abbreviation, we expect the full name to be at the beginning of the documentation, in parentheses.
 * @param {String} documentation The documentation string
 * @returns {String}
 */
const getFullNameFromDocumentation = (documentation: string) => {
  const hit = /^\((.*?)\)/.exec(documentation);
  if (hit !== null) return hit[1];
  return '';
};

// export default SchemaNavigator;
