
import type { RedisLike, ScheduleRecord, callbackFn } from "./types";
import { Scheduler } from "./scheduler";

export interface SchedulerManagerOptions {
  redis: RedisLike;
  defaultMaxJitterMs?: number;
}

export class SchedulerManager {
  private redis: RedisLike;
  private callback: callbackFn;
  private schedulers = new Map<string, Scheduler>();
  private defaultMaxJitterMs: number;

  constructor(callbackFunc: callbackFn, opts: SchedulerManagerOptions) {
    this.redis = opts.redis;
    this.callback = callbackFunc;
    this.defaultMaxJitterMs = opts.defaultMaxJitterMs ?? 30_000;
  }

  /** Load all schedules from DB on startup */
  public async loadInitialSchedules(
    schedules: ScheduleRecord[]
  ): Promise<void> {
    for (const s of schedules) {
      this.upsertSchedule(s);
    }
  }

  /** Create or update a schedule in memory */
  public upsertSchedule(schedule: ScheduleRecord): void {
    const existing = this.schedulers.get(schedule.id);

    if (!schedule.enabled) {
      if (existing) {
        existing.stop();
        this.schedulers.delete(schedule.id);
      }
      return;
    }

    const jitter = this.getMaxJitterForSchedule(schedule);

    if (existing) {
      existing.update(schedule.cronExpression, schedule.timezone, jitter);
    } else {
      const sched = new Scheduler({
        scheduleId: schedule.id,
        name: schedule.name,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        redis: this.redis,
        maxJitterMs: jitter,
        callback: () => this.callback(schedule),
      });

      this.schedulers.set(schedule.id, sched);
    }
  }

  /** Delete or disable a schedule */
  public removeSchedule(scheduleId: string): void {
    const existing = this.schedulers.get(scheduleId);
    if (existing) {
      existing.stop();
      this.schedulers.delete(scheduleId);
    }
  }

  /** For observability / tests */
  public listActiveScheduleIds(): string[] {
    return Array.from(this.schedulers.keys());
  }

  protected getMaxJitterForSchedule(_schedule: ScheduleRecord): number {
    // hook for custom per-tenant logic; override in subclass if needed
    return this.defaultMaxJitterMs;
  }
}
