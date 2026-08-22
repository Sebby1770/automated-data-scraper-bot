export interface StateStore {
  has(key: string): Promise<boolean>;
  mark(key: string): Promise<void>;
  /** Store an explicit timestamp value for a key (used for snooze expiries). */
  markAt?(key: string, timestamp: string): Promise<void>;
  prune?(): Promise<void>;
  seenAt?(key: string): Promise<string | undefined>;
}
