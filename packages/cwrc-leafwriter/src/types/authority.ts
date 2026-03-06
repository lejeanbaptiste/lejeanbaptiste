import { z } from 'zod';

export const authorities = [
  'dbpedia',
  'geonames',
  'getty',
  'lincs',
  'viaf',
  'wikidata',
  'gnd',
] as const;
export const authoritySchema = z.enum(authorities);
export type Authority = z.infer<typeof authoritySchema>;

export const namedEntityTypes = [
  'person',
  'place',
  'organization',
  'work',
  'thing',
  'concept',
  'citation',
] as const;
export const namedEntityTypesSchema = z.enum(namedEntityTypes);
export type NamedEntityType = z.infer<typeof namedEntityTypesSchema>;

export const authorityLookupParamsSchema = z.object({
  query: z.string(),
  entityType: namedEntityTypesSchema,
  options: z.optional(z.record(z.string(), z.any())),
});
export type AuthorityLookupParams = z.infer<typeof authorityLookupParamsSchema>;

export const authorityLookupResultSchema = z.object({
  description: z.string().optional(),
  label: z.string(),
  uri: z.url(),
});
export type AuthorityLookupResult = z.infer<typeof authorityLookupResultSchema>;

export const searchFunctionSchema = z
  .function({ input: [authorityLookupParamsSchema], output: z.promise(z.array(authorityLookupResultSchema)) });
export type SearchFunction = z.infer<typeof searchFunctionSchema>;

export const entityTypePropsSchema = z.object({
  name: namedEntityTypesSchema,
  url: z.url().startsWith('https://', {
      error: 'Must provide secure URL'
}).optional(),
});
export type EntityTypeProps = z.infer<typeof entityTypePropsSchema>;

const baseAuthorityServiceConfigSchema = z.object({
  author: z
    .object({
      name: z.string(),
      url: z.string().optional(),
    })
    .optional(),
  description: z.string().optional(),
  name: z
    .string({
        error: (issue) => issue.input === undefined ? 'Every authority needs a name' : undefined
    })
    .min(3, {
        error: 'Must be at least 3 characters'
    })
    .max(20, {
        error: 'Cannot have more than 20 characters'
    }),
  url: z.url().optional(),
});

export const localAuthorityServiceConfigSchema = baseAuthorityServiceConfigSchema.extend({
  id: z.string(),
  searchType: z.literal('TEI-FILE'),
  entityTypes: z
    .array(entityTypePropsSchema.required())
    .min(1, {
        error: 'At least one entity type is required'
    }),
  options: z.object({ maxResults: z.number().prefault(10).optional() }).optional(),
});
export type LocalAuthorityServiceConfig = z.infer<typeof localAuthorityServiceConfigSchema>;

export const authorityServiceConfigSchema = baseAuthorityServiceConfigSchema.extend({
  entityTypes: z
    .array(entityTypePropsSchema.extend({ priority: z.number().optional() }))
    .or(z.array(namedEntityTypesSchema)),
  search: searchFunctionSchema,
});
export type AuthorityServiceConfig = z.infer<typeof authorityServiceConfigSchema>;

export const AuthorityServiceSchema = authorityServiceConfigSchema.extend({
  entityTypes: z.map(namedEntityTypesSchema, entityTypePropsSchema),
  id: z.string(),
  isCustom: z.boolean().optional(),
  isLocal: z.boolean().optional(),
});
export type AuthorityService = z.infer<typeof AuthorityServiceSchema>;

export type AuthorityServices = Map<string, AuthorityService>;

export interface LookupServicePreference {
  authorityId: string;
  entityType: NamedEntityType;
  disabled?: boolean;
  id: string;
  priority: number;
}

export interface EntityLookupDialogProps {
  isUserAuthenticated: boolean;
  onClose: (response?: EntityLink) => void;
  query: string;
  type: NamedEntityType;
}

export interface EntryLink {
  authority: Authority | (string & {});
  entityType: NamedEntityType;
  label: string;
  uri: string;
}

export interface EntityLink {
  id: string;
  name: string;
  properties: {
    lemma: string;
    uri: string;
  };
  query: string;
  repository: string;
  type: string;
  uri: string;
}
