import { SimplePaletteColorOptions } from '@mui/material/styles';
interface Entity {
    color: SimplePaletteColorOptions;
    icon: string;
}
interface Entities {
    person: Entity;
    place: Entity;
    organization: Entity;
    org: Entity;
    title: Entity;
    referencing_string: Entity;
    rs: Entity;
    citation: Entity;
    note: Entity;
    date: Entity;
    correction: Entity;
    keyword: Entity;
    link: Entity;
}
declare module '@mui/material/styles' {
    interface Theme {
        entity: Entities;
    }
    interface ThemeOptions {
        entity?: Entities;
    }
}
declare const theme: (darkMode: boolean) => import("@mui/material").Theme;
export default theme;
//# sourceMappingURL=index.d.ts.map