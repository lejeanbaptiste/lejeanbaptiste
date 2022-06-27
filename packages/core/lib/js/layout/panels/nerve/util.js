export const doLookup = (writer, query, type, callback) => {
    const cD = writer.initialConfig.entityLookupDialogs;
    // cD.showCreateNewButton(false);
    // cD.showNoLinkButton(false);
    // cD.showEditButton(false);
    if (type === 'org')
        type = 'organization';
    cD.popSearch[type]({
        query: query,
        parentEl: writer.dialogManager.getDialogWrapper(),
        success: (result) => {
            if (Array.isArray(result.name))
                result.name = result.name[0];
            callback.call(cD, result);
        },
        //@ts-ignore
        error: (errorThrown) => { },
    });
};
//# sourceMappingURL=util.js.map