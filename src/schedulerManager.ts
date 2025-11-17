
import type { PubSubConfig, ScheduleEvent, ScheduleRecord, callbackFn } from "./types";
import { Scheduler } from "./scheduler";
import Redis from "ioredis";
export const DEFAULT_SCHEDULE_CHANNEL = "redis-distro-scheduler:schedules";

export interface SchedulerManagerOptions {
  redisUrl: string;
  defaultMaxJitterMs?: number;
  pubSub?: PubSubConfig;
}

export class SchedulerManager {
  private redis: string;
  private callback: callbackFn;
  private schedulers = new Map<string, Scheduler>();
  private defaultMaxJitterMs: number;

  // Pub/sub related
  private pubSub?: PubSubConfig;
  private scheduleChannel: string;
  private isSubscribed = false;
  private redisMain: Redis;
  private redisSub: Redis;

  constructor(callbackFunc: callbackFn, opts: SchedulerManagerOptions) {
    this.redisMain = new Redis(opts.redisUrl!);
    this.redisSub = this.redisMain.duplicate();

    this.redis = opts.redisUrl;
    this.callback = callbackFunc;
    this.defaultMaxJitterMs = opts.defaultMaxJitterMs ?? 30_000;

    this.pubSub = opts.pubSub ?? { pub: this.redisMain, sub: this.redisSub, channel: DEFAULT_SCHEDULE_CHANNEL };
    this.scheduleChannel =
      opts.pubSub?.channel ?? DEFAULT_SCHEDULE_CHANNEL;

    if (this.pubSub) {
      this.initPubSub();
    }
  }

  /** Load all schedules from DB on startup */
  public async loadInitialSchedules(
    schedules: ScheduleRecord[]
  ): Promise<void> {
    for (const s of schedules) {
      this.upsertSchedule({...s, enabled: s.enabled ?? true}, { broadcast: false });
    }
  }

  /** Create or update a schedule in memory */
  public upsertSchedule(schedule: ScheduleRecord, options?: { broadcast?: boolean }): void {
    const existing = this.schedulers.get(schedule.id);
    if (Object.hasOwn(schedule, "enabled") && !schedule.enabled) {
      if (existing) {
        existing.stop();
        this.schedulers.delete(schedule.id);
      }
      // still broadcast disable/removal
      if (options?.broadcast !== false) {
        this.publishEvent({ type: "remove", scheduleId: schedule.id });
      }
      return;
    }

    const jitter = this.getMaxJitterForSchedule(schedule);
    if (existing) {
      existing.update(schedule.cronExpression, schedule.timezone, jitter);
    } else {
      const sched = new Scheduler({
        scheduleId: schedule.id,
        name: schedule.name ?? schedule.id,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        redis: this.redisMain,
        maxJitterMs: jitter,
        callback: () => this.callback(schedule),
      });
      this.schedulers.set(schedule.id, sched);
    }
  }

  /** Delete or disable a schedule */
  public removeSchedule(scheduleId: string, options?: { broadcast?: boolean }): void {
    const existing = this.schedulers.get(scheduleId);
    if (existing) {
      existing.stop();
      this.schedulers.delete(scheduleId);
    }
    if (options?.broadcast !== false) {
      this.publishEvent({ type: "remove", scheduleId });
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

  private initPubSub(): void {
    if (!this.pubSub) return;
    const { sub } = this.pubSub;

    if (!sub.subscribe || !sub.on) {
      throw new Error(
        "[redis-distro-scheduler] Provided sub client does not support subscribe()/on()"
      );
    }

    if (this.isSubscribed) return;

    this.isSubscribed = true;

    // Subscribe to schedule sync channel
    sub.subscribe(this.scheduleChannel).catch(err => {
      // eslint-disable-next-line no-console
      console.error("[redis-distro-scheduler] Failed to subscribe to schedule channel",err);
    })

    sub.on("message", (channel: string, message: string) => {
      if (channel !== this.scheduleChannel) return;

      let event: ScheduleEvent;
      try {
        event = JSON.parse(message) as ScheduleEvent;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          "[redis-distro-scheduler] Failed to parse schedule event",
          err
        );
        return;
      }

      // Apply event locally but DO NOT broadcast again
      if (event.type === "upsert") {
        this.upsertSchedule(event.schedule, { broadcast: false });
      } else if (event.type === "remove") {
        this.removeSchedule(event.scheduleId, { broadcast: false });
      }
    });
  }

  private publishEvent(event: ScheduleEvent): void {
    if (!this.pubSub || !this.pubSub.pub.publish) return;

    try {
      const json = JSON.stringify(event);
      this.pubSub.pub.publish(this.scheduleChannel, json).catch((err) => {
        console.error(
          "[redis-distro-scheduler] Failed to publish schedule event",
          err
        );
      });
    } catch (err) {
      console.error(
        "[redis-distro-scheduler] Failed to serialize schedule event", err
      );
    }
  }
}
