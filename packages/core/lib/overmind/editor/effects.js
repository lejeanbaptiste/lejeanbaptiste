export const api = (() => {
    let lookupsDefaults;
    return {
        getLookupsDefaults: () => {
            return lookupsDefaults;
        },
        setLookupsDefaults: (value) => {
            lookupsDefaults = value;
        },
        saveToLocalStorage: (key, value) => {
            localStorage.setItem(key, value);
        },
        getFromLocalStorage: (key) => {
            return localStorage.getItem(key);
        },
        removeFromLocalStorage: (key) => {
            localStorage.removeItem(key);
        },
    };
})();
//# sourceMappingURL=effects.js.map