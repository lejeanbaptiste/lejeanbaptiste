// ! Configuring Your Testing Environment
// https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html
//@ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import '@testing-library/jest-dom';

const noop = () => {};
Object.defineProperty(window, 'scrollTo', { value: noop, writable: true });