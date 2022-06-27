export const SupportedSchemas = new Map();
export const Languages = new Map();
//ENTITY
export var EntityType;
(function (EntityType) {
    EntityType["PERSON"] = "person";
    EntityType["PLACE"] = "place";
    EntityType["ORGANIZATION"] = "organization";
    EntityType["ORG"] = "org";
    EntityType["REFERENCING_STRING"] = "referencing_string";
    EntityType["RS"] = "rs";
    EntityType["TITLE"] = "title";
    EntityType["CITATION"] = "citation";
    EntityType["NOTE"] = "note";
    EntityType["DATE"] = "date";
    EntityType["CORRECTION"] = "correction";
    EntityType["KEYWORD"] = "keyword";
    EntityType["LINK"] = "link";
})(EntityType || (EntityType = {}));
//# sourceMappingURL=index.js.map