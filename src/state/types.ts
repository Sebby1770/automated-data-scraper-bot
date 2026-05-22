export interface StateStore {
  has(key: string): Promise<boolean>;
  mark(key: string): Promise<void>;
  prune?(): Promise<void>;
}
