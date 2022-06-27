declare const useSettings: () => {
    editorModeShouldChange: (editorMode: string) => [boolean, null | {
        type: string;
        text: string;
    }];
    changeEditorMode: ({ mode, isUndo }: {
        mode: string;
        isUndo?: boolean;
    }) => string;
    changeAnnotationMode: ({ mode, isUndo }: {
        mode: number;
        isUndo?: boolean;
    }) => string;
    schemaShouldChange: (schemaId: string) => Promise<[boolean, null | {
        type: string;
        text: string;
    }]>;
    changeSchema: ({ schemaId, isUndo }: {
        schemaId: string;
        isUndo?: boolean;
    }) => string;
};
export default useSettings;
//# sourceMappingURL=useSettings.d.ts.map