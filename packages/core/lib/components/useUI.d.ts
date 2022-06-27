import type { SvgIconTypeMap } from '@mui/material/SvgIcon';
import type { OverridableComponent } from '@mui/material/OverridableComponent';
export declare const useUI: () => {
    getIcon: (name?: string) => OverridableComponent<SvgIconTypeMap<{}, "svg">> & {
        muiName: string;
    };
};
export default useUI;
//# sourceMappingURL=useUI.d.ts.map