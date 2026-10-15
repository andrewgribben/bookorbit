import { MetadataProviderKey } from "./metadata-fetch";

export type MetadataField =
  | "title"
  | "subtitle"
  | "description"
  | "cover"
  | "audioCover"
  | "authors"
  | "publisher"
  | "publishedYear"
  | "language"
  | "pageCount"
  | "communityRating"
  | "seriesName"
  | "seriesIndex"
  | "genres"
  | "narrators"
  | "duration"
  | "abridged";

export const ALL_METADATA_FIELDS: MetadataField[] = [
  "title",
  "subtitle",
  "description",
  "cover",
  "audioCover",
  "authors",
  "publisher",
  "publishedYear",
  "language",
  "pageCount",
  "communityRating",
  "seriesName",
  "seriesIndex",
  "genres",
  "narrators",
  "duration",
  "abridged",
];

/**
 * Local Field Rules sources read from the library on disk rather than a remote catalog.
 * They share the provider priority list with remote providers but are not MetadataProviderKey values.
 */
export const MetadataLocalSourceKey = {
  FOLDER: "folder",
} as const;

export type MetadataLocalSourceKey = (typeof MetadataLocalSourceKey)[keyof typeof MetadataLocalSourceKey];

export const ALL_METADATA_LOCAL_SOURCE_KEYS: MetadataLocalSourceKey[] = [MetadataLocalSourceKey.FOLDER];

export type MetadataFieldSourceKey = MetadataProviderKey | MetadataLocalSourceKey;

export const LOCAL_SOURCE_SUPPORTED_FIELDS: Record<MetadataLocalSourceKey, readonly MetadataField[]> = {
  [MetadataLocalSourceKey.FOLDER]: ["seriesName", "seriesIndex"],
};

export function isMetadataLocalSourceKey(value: string): value is MetadataLocalSourceKey {
  return (ALL_METADATA_LOCAL_SOURCE_KEYS as readonly string[]).includes(value);
}

export function localSourceSupportsField(source: MetadataLocalSourceKey, field: MetadataField): boolean {
  return LOCAL_SOURCE_SUPPORTED_FIELDS[source]?.includes(field) ?? false;
}

export type MergeStrategy = "fillMissing" | "overwrite" | "overwriteIfProvided";
export type MetadataMergeStrategy = MergeStrategy | "mergeExisting";
export type GenreMergeMode = "firstProvider" | "merge";
export type ProviderIdFetchMode = "preferExisting" | "existingOnly";
export const MERGE_STRATEGIES: MergeStrategy[] = ["fillMissing", "overwrite", "overwriteIfProvided"];
export const GENRE_MERGE_STRATEGIES: MetadataMergeStrategy[] = ["fillMissing", "mergeExisting", "overwriteIfProvided", "overwrite"];
export const GENRE_MERGE_MODES: GenreMergeMode[] = ["firstProvider", "merge"];
export const PROVIDER_ID_FETCH_MODES: ProviderIdFetchMode[] = ["preferExisting", "existingOnly"];
export const MAX_METADATA_GENRE_COUNT = 50;

export interface FieldPreference {
  enabled: boolean;
  providers: MetadataFieldSourceKey[];
  mergeStrategy: MetadataMergeStrategy;
}

export type FieldPreferenceOverrides = Partial<Record<MetadataField, FieldPreference>>;

export interface MetadataFetchOptions {
  genres: {
    mode: GenreMergeMode;
    blocklist: string[];
    maxCount: number | null;
  };
  saveProviderIds: boolean;
  providerIdMode: ProviderIdFetchMode;
}

export interface MetadataFetchPreferences {
  fields: Record<MetadataField, FieldPreference>;
  options?: MetadataFetchOptions;
}

export interface LibraryMetadataPreferences {
  libraryId: number;
  overrides: FieldPreferenceOverrides | null;
  effective: MetadataFetchPreferences;
}

export interface GoogleProviderConfig {
  enabled: boolean;
  apiKey: string;
}

export interface HardcoverProviderConfig {
  enabled: boolean;
  apiKey: string;
}

export interface AmazonProviderConfig {
  enabled: boolean;
  domain: string;
  cookie: string;
}

export interface SimpleProviderConfig {
  enabled: boolean;
}

export type ITunesCoverResolution = "standard" | "high";
export const ITUNES_COVER_RESOLUTIONS: ITunesCoverResolution[] = ["standard", "high"];

export interface ITunesProviderConfig {
  enabled: boolean;
  coverResolution: ITunesCoverResolution;
}

export interface AudibleProviderConfig {
  enabled: boolean;
  domain: string;
}

export interface AudnexusProviderConfig {
  enabled: boolean;
}

export interface ComicVineProviderConfig {
  enabled: boolean;
  apiKey: string;
}

export interface KoboProviderConfig {
  enabled: boolean;
  country: string;
  language: string;
}

export interface AladinProviderConfig {
  enabled: boolean;
  ttbKey: string;
}

export interface ProviderConfigurations {
  google: GoogleProviderConfig;
  amazon: AmazonProviderConfig;
  goodreads: SimpleProviderConfig;
  hardcover: HardcoverProviderConfig;
  openLibrary: SimpleProviderConfig;
  itunes: ITunesProviderConfig;
  audible: AudibleProviderConfig;
  audnexus: AudnexusProviderConfig;
  librofm: SimpleProviderConfig;
  comicvine: ComicVineProviderConfig;
  ranobedb: SimpleProviderConfig;
  kobo: KoboProviderConfig;
  lubimyczytac: SimpleProviderConfig;
  aladin: AladinProviderConfig;
}

export interface ProviderStatus {
  key: MetadataFieldSourceKey;
  label: string;
  configured: boolean;
  enabled: boolean;
  hint?: string;
  /** True for local disk sources such as Folder; omitted for remote catalog providers. */
  local?: boolean;
}

export type ProviderConnectionTestStatus = "success" | "warning" | "fail";

export interface ProviderConnectionTestResult {
  key: MetadataProviderKey;
  ok: boolean;
  status: ProviderConnectionTestStatus;
  message: string;
}
