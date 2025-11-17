
import type { ScheduledTask } from "node-cron";

// Very small Redis interface for locking.
export interface RedisLike {
  set(
    key: string,
    value: string,
    mode?: "NX" | "XX",
    px?: "PX",
    ttlMs?: number
  ): Promise<"OK" | null | undefined> | ("OK" | null | undefined);
  del(key: string): Promise<number> | number;
  publish?(channel: string, message: string): Promise<number> | number;
  subscribe?(channel: string): Promise<void> | void;
  on?(event: string, listener: (...args: any[]) => void): void;
}

export interface ScheduleRecord {
  id: string;
  name: string;
  cronExpression: string;
  timezone?: string;
  payload: any;
  enabled: boolean;
}

export type callbackFn = (schedule: ScheduleRecord) => Promise<void>;

export interface SchedulerOptions {
  scheduleId: string;
  name: string;
  cronExpression: string;
  timezone?: string;
  redis: RedisLike;
  lockTtlMs?: number;
  maxJitterMs?: number;
  callback: () => Promise<void> | void;
}

export interface SchedulerInternal {
  start(): void;
  stop(): void;
  update(cronExpression: string, timezone?: string, maxJitterMs?: number): void;
  getTask(): ScheduledTask | null;
}
