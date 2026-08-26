export interface TempVoiceLeaseRunner {
  withLease<T>(aggregateKey: string, callback: () => Promise<T>): Promise<T>;
}
