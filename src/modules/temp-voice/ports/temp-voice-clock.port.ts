export interface TempVoiceClock {
  now(): Date;
}

export class SystemTempVoiceClock implements TempVoiceClock {
  public now(): Date {
    return new Date();
  }
}
