import type { ILookups } from '../../components/entityLookups/types';
export declare const api: {
    getLookupsDefaults: () => ILookups;
    setLookupsDefaults: (value: ILookups) => void;
    saveToLocalStorage: (key: string, value: string) => void;
    getFromLocalStorage: (key: string) => string;
    removeFromLocalStorage: (key: string) => void;
};
//# sourceMappingURL=effects.d.ts.map