-- Libraries that grouped comics by folder now use the folder_series path-rule preset.
UPDATE "libraries"
SET "regex_metadata" = $preset${"preset":"folder_series","rules":[{"pattern":"^(?:.*?/)??(?<runParent>[^/]+)/(?:vol(?:ume)?|tome)\\.?[\\s_-]*\\d+[^/]*/(?<series>\\k<runParent>\\s*\\((?:19|20)\\d{2}\\))[^/]*?(?:(?<![\\p{L}\\p{N}(\\[])(?:c|ch|chap|chapter|chapitre|cap|capitulo|issue|no|nr|n°)\\.?[\\s_-]*(?!(?:19|20)\\d{2}(?!\\d))|#\\s*|第\\s*)0*(?<seriesIndex>\\d+(?:[.,]\\d+)?)(?![\\p{L}\\p{N}])[^/]*$","flags":"iu"},{"pattern":"^(?:.*?/)??(?<runParent>[^/]+)/(?:vol(?:ume)?|tome)\\.?[\\s_-]*\\d+[^/]*/(?<series>\\k<runParent>\\s*\\((?:19|20)\\d{2}\\))[^/]*?[\\s_]0*(?<seriesIndex>(?!(?:19|20)\\d{2}(?!\\d))\\d{1,4}(?:\\.\\d+)?)(?![\\p{L}\\p{N}])(?:\\s*[\\[(][^\\]()/]*[\\])])*(?:\\s+-\\s[^/]*)?\\s*$","flags":"iu"},{"pattern":"^(?:.*?/)??(?!(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/)(?:[\\[{][^\\]}/]*[\\]}]\\s*)*(?<series>[^/\\[{\\s][^/]*?)(?<![\\]}\\s])(?:\\s*[\\[{][^\\]}/]*[\\]}])*/(?:specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/[^/]+$","flags":"iu"},{"pattern":"^(?:.*?/)??(?!(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/)(?:[\\[{][^\\]}/]*[\\]}]\\s*)*(?<series>[^/\\[{\\s][^/]*?)(?<![\\]}\\s])(?:\\s*[\\[{][^\\]}/]*[\\]}])*/(?:(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|\\k<series>[\\s._-]*(?:vol(?:ume)?|tome|v)\\.?[\\s_-]*\\d+[^/]*)/)?[^/]*?(?:(?<![\\p{L}\\p{N}(\\[])(?:c|ch|chap|chapter|chapitre|cap|capitulo|issue|no|nr|n°)\\.?[\\s_-]*(?!(?:19|20)\\d{2}(?!\\d))|#\\s*|第\\s*)0*(?<seriesIndex>\\d+(?:[.,]\\d+)?)(?![\\p{L}\\p{N}])[^/]*$","flags":"iu"},{"pattern":"^(?:.*?/)??(?!(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/)(?:[\\[{][^\\]}/]*[\\]}]\\s*)*(?<series>[^/\\[{\\s][^/]*?)(?<![\\]}\\s])(?:\\s*[\\[{][^\\]}/]*[\\]}])*/(?:(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|\\k<series>[\\s._-]*(?:vol(?:ume)?|tome|v)\\.?[\\s_-]*\\d+[^/]*)/)?[^/]*?(?<![\\p{L}\\p{N}(\\[])(?:v|vol|volume)\\.?[\\s_-]*\\d+[\\s_]+(?:#\\s*)?0*(?<seriesIndex>\\d+(?:[.,]\\d+)?)(?![\\p{L}\\p{N}])[^/]*$","flags":"iu"},{"pattern":"^(?:.*?/)??(?!(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/)(?:[\\[{][^\\]}/]*[\\]}]\\s*)*(?<series>[^/\\[{\\s][^/]*?)(?<![\\]}\\s])(?:\\s*[\\[{][^\\]}/]*[\\]}])*/(?:(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|\\k<series>[\\s._-]*(?:vol(?:ume)?|tome|v)\\.?[\\s_-]*\\d+[^/]*)/)?[^/]*?(?<![\\p{L}\\p{N}(\\[])(?:t|tome|tomo|v|vol|volume|band|book|livre|libro)\\.?[\\s_-]*0*(?<seriesIndex>\\d+(?:[.,]\\d+)?)(?![\\p{L}\\p{N}])[^/]*$","flags":"iu"},{"pattern":"^(?:.*?/)??(?!(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/)(?:[\\[{][^\\]}/]*[\\]}]\\s*)*(?<series>[^/\\[{\\s][^/]*?)(?<![\\]}\\s])(?:\\s*[\\[{][^\\]}/]*[\\]}])*/(?:(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|\\k<series>[\\s._-]*(?:vol(?:ume)?|tome|v)\\.?[\\s_-]*\\d+[^/]*)/)?[^/]*?(?<!\\p{N})0*(?<seriesIndex>\\d+(?:\\.\\d+)?)\\s*(?:話|话|화|회|章)[^/]*$","flags":"iu"},{"pattern":"^(?:.*?/)??(?!(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/)(?:[\\[{][^\\]}/]*[\\]}]\\s*)*(?<series>[^/\\[{\\s][^/]*?)(?<![\\]}\\s])(?:\\s*[\\[{][^\\]}/]*[\\]}])*/(?:(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|\\k<series>[\\s._-]*(?:vol(?:ume)?|tome|v)\\.?[\\s_-]*\\d+[^/]*)/)?[^/]*?(?<!\\p{N})0*(?<seriesIndex>\\d+(?:\\.\\d+)?)\\s*(?:巻|卷|권|冊|册)[^/]*$","flags":"iu"},{"pattern":"^(?:.*?/)??(?!(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/)(?:[\\[{][^\\]}/]*[\\]}]\\s*)*(?<series>[^/\\[{\\s][^/]*?)(?<![\\]}\\s])(?:\\s*[\\[{][^\\]}/]*[\\]}])*/(?:(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|\\k<series>[\\s._-]*(?:vol(?:ume)?|tome|v)\\.?[\\s_-]*\\d+[^/]*)/)?0*(?<seriesIndex>(?!(?:19|20)\\d{2}(?!\\d))\\d{1,4}(?:\\.\\d+)?)(?:\\s*[-\\u2013_.)\\]]\\s*(?!\\d)[^/]*)?$","flags":"iu"},{"pattern":"^(?:.*?/)??(?!(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/)(?:[\\[{][^\\]}/]*[\\]}]\\s*)*(?<series>[^/\\[{\\s][^/]*?)(?<![\\]}\\s])(?:\\s*[\\[{][^\\]}/]*[\\]}])*/(?:(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|\\k<series>[\\s._-]*(?:vol(?:ume)?|tome|v)\\.?[\\s_-]*\\d+[^/]*)/)?[^/]*?[\\s_]0*(?<seriesIndex>(?!(?:19|20)\\d{2}(?!\\d))\\d{1,4}(?:\\.\\d+)?)(?![\\p{L}\\p{N}])(?:\\s*[\\[(][^\\]()/]*[\\])])*(?:\\s+-\\s[^/]*)?\\s*$","flags":"iu"},{"pattern":"^(?:.*?/)??(?!(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|specials?|extras?|annuals?|bonus|one[\\s_-]?shots?|_oneshots)/)(?:[\\[{][^\\]}/]*[\\]}]\\s*)*(?<series>[^/\\[{\\s][^/]*?)(?<![\\]}\\s])(?:\\s*[\\[{][^\\]}/]*[\\]}])*/(?:(?:(?:\\d+[\\s._-]+)?(?:vol(?:ume)?|tome|tomo|band|livre|libro|part|pt|arc|season|saison|v)\\.?[\\s_-]*\\d+[^/]*|(?:19|20)\\d{2}|\\k<series>[\\s._-]*(?:vol(?:ume)?|tome|v)\\.?[\\s_-]*\\d+[^/]*)/)?[^/]+$","flags":"iu"}]}$preset$::jsonb
WHERE "derive_series_from_folder" = true
  AND "regex_metadata" IS NULL;
--> statement-breakpoint
ALTER TABLE "libraries" DROP CONSTRAINT IF EXISTS "libraries_derive_series_from_folder_mode_chk";
--> statement-breakpoint
ALTER TABLE "libraries" DROP COLUMN IF EXISTS "derive_series_from_folder";
--> statement-breakpoint
UPDATE "app_settings"
SET "value" = (
  SELECT jsonb_set(
    "value"::jsonb,
    '{fields}',
    COALESCE((
      SELECT jsonb_object_agg(
        fields.key,
        CASE
          WHEN jsonb_typeof(fields.field -> 'providers') = 'array' THEN
            jsonb_set(
              fields.field,
              '{providers}',
              COALESCE((
                SELECT jsonb_agg(provider)
                FROM jsonb_array_elements(fields.field -> 'providers') AS provider
                WHERE provider <> '"folder"'::jsonb
              ), '[]'::jsonb)
            )
          ELSE fields.field
        END
      )
      FROM jsonb_each(COALESCE("value"::jsonb -> 'fields', '{}'::jsonb)) AS fields(key, field)
    ), '{}'::jsonb)
  )::text
)
WHERE "key" = 'metadata_fetch_preferences'
  AND position('"folder"' in "value") > 0;
--> statement-breakpoint
UPDATE "libraries"
SET "metadata_fetch_preferences" = (
  SELECT COALESCE(jsonb_object_agg(
    fields.key,
    CASE
      WHEN jsonb_typeof(fields.field -> 'providers') = 'array' THEN
        jsonb_set(
          fields.field,
          '{providers}',
          COALESCE((
            SELECT jsonb_agg(provider)
            FROM jsonb_array_elements(fields.field -> 'providers') AS provider
            WHERE provider <> '"folder"'::jsonb
          ), '[]'::jsonb)
        )
      ELSE fields.field
    END
  ), '{}'::jsonb)
  FROM jsonb_each("metadata_fetch_preferences") AS fields(key, field)
)
WHERE "metadata_fetch_preferences" IS NOT NULL
  AND "metadata_fetch_preferences"::text LIKE '%"folder"%';
