export type TkSyncDisabledReason = "permission_denied" | "missing_token" | "invalid_token" | "daily_note_shared";

export interface TkSettings {
  connected: boolean;
  enabled: boolean;
  effectiveEnabled: boolean;
  disabledReason: TkSyncDisabledReason | null;
  lastSyncedAt: string | null;
  connectedAt: string | null;
  backfillRequestedAt: string | null;
  syncAnnotations: boolean;
  syncJournal: boolean;
  syncFinished: boolean;
}

export interface UpsertTkSettingsPayload {
  enabled?: boolean;
  syncAnnotations?: boolean;
  syncJournal?: boolean;
  syncFinished?: boolean;
}

export interface TkConnectStartResult {
  authorizeUrl: string;
}

export interface TkConnectFinishPayload {
  callbackUrl: string;
}

export interface TkBackfillPreview {
  itemCount: number;
  dayCount: number;
  oldestDateKey: string | null;
}
