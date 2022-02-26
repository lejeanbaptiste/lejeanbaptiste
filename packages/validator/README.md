# CWRC-Worker-Validator

================

## JSDOM inside webworkers

### From JSDOM documentation

[https://github.com/jsdom/jsdom#running-jsdom-inside-a-web-browser](https://github.com/jsdom/jsdom#running-jsdom-inside-a-web-browser)

**Running jsdom inside a web browser**
jsdom has some support for being run inside a web browser, using browserify. That is, inside a web browser, you can use a browserified jsdom to create an entirely self-contained set of plain JavaScript objects which look and act much like the browser's existing DOM objects, while being entirely independent of them. "Virtual DOM", indeed!

jsdom's primary target is still Node.js, and so we use language features that are only present in recent Node.js versions (namely, Node.js v8+). Thus, older browsers will likely not work. (Even transpilation will not help: we use Proxys extensively throughout the jsdom codebase.)

Notably, jsdom works well inside a web worker. The original contributor, @lawnsea, who made this possible, has published a paper about his project which uses this capability.

Not everything works perfectly when running jsdom inside a web browser. Sometimes that is because of fundamental limitations (such as not having filesystem access), but sometimes it is simply because we haven't spent enough time making the appropriate small tweaks. Bug reports are certainly welcome.

### Discussion

[https://github.com/jsdom/jsdom/issues/245](https://github.com/jsdom/jsdom/issues/245)
[https://github.com/jsdom/jsdom/issues/1284](https://github.com/jsdom/jsdom/issues/1284)
[https://github.com/jsdom/jsdom/issues/2427](https://github.com/jsdom/jsdom/issues/2427)

### How To use JSDOM on CWRC-WRITER Web Worker

A browserified and fixed verion of jsdom (v. 16.6.0) is aleready in place on the webworkers folder `/src/webworkers/lib/jsdom`

If the file needs to be updated or regenerated, follow these steps:

1. Install JSDOM and Browserify
`npm i -D jsdom browserify`

2. Browserify jsdom
`npm run browserify-jsdom` (check package.json for the details)

3. Fixes

3.1 fix *AsyncIteratorPrototype*
AsyncIteratorPrototype is throwing an error when running on workers. Since we don't use this method, we just return it as an empty objects.

- Open /src/webworkers/lib/jsdom/jsdon-browserified.js`
- locate the line where AsyncIteratorPrototype is defined.
- replace this line: `const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {}).prototype);`
- for this one: `const AsyncIteratorPrototype = {};`
  
3.2 fix *SharedArrayBuffer*
SharedArrayBuffer is throwing an error when running on workers. Since we don't use this method, we just return it as an empty objects.

- Open /src/webworkers/lib/jsdom/jsdon-browserified.js`
- locate the line where sabByteLengthGetter is defined.
- eplace this line: `const sabByteLengthGetter = Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength").get;`
- for this one: `const sabByteLengthGetter = {}`;
