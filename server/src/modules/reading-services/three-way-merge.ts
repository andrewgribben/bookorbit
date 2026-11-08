export type MergeAction<T> = { action: 'none' } | { action: 'push'; value: T } | { action: 'pull'; value: T };

/**
 * Decide what to do with one field given its current local and remote values and the value
 * last synced (the snapshot). BookOrbit wins when both sides changed since that snapshot.
 */
export function mergeField<T>(local: T, remote: T, snapshot: T | undefined, equal: (a: T, b: T) => boolean = Object.is): MergeAction<T> {
  if (equal(local, remote)) return { action: 'none' };
  if (snapshot === undefined) return { action: 'push', value: local };

  const localChanged = !equal(local, snapshot);
  const remoteChanged = !equal(remote, snapshot);

  if (remoteChanged && !localChanged) return { action: 'pull', value: remote };
  return { action: 'push', value: local };
}
