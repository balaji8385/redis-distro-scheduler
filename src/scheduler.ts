
import cron, { ScheduledTask } from "node-cron";
import type { RedisLike, SchedulerOptions, SchedulerInternal } from "./types";

export class Scheduler implements SchedulerInternal {
  private id: string;
  private name?: string;
  private cronExpression: string;
  private timezone?: string;
  private redis: RedisLike;
  private lockKey: string;
  private lockTtlMs: number;
  private maxJitterMs: number;
  private job: ScheduledTask | null = null;
  private callback: () => Promise<void> | void;

  constructor(opts: SchedulerOptions) {
    this.id = opts.scheduleId;
    this.name = opts.name;
    this.cronExpression = opts.cronExpression;
    this.timezone = opts.timezone;
    this.redis = opts.redis;
    this.lockKey = `redis-distro-scheduler:report:${this.id}:lock`;
    this.lockTtlMs = opts.lockTtlMs ?? 10 * 60_000; // 10 minutes
    this.maxJitterMs = opts.maxJitterMs ?? 30_000; // up to 30s jitter
    this.callback = opts.callback;

    this.start();
  }

  public start(): void {
    if (this.job) {
      this.job.stop();
    }

    this.job = cron.schedule(
      this.cronExpression,
      async () => {
        if (!(await this.tryLock())) return;

        try {
          const jitter = this.getJitterDelay();
          if (jitter > 0) {
            await new Promise((resolve) => setTimeout(resolve, jitter));
          }

          await this.callback();
        } finally {
          await this.unlock();
        }
      },
      {
        scheduled: true,
        timezone: this.timezone,
      }
    );
  }

  public stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
  }

  public update(cronExpression: string, timezone?: string, maxJitterMs?: number): void {
    this.cronExpression = cronExpression;
    if (timezone) this.timezone = timezone;
    if (typeof maxJitterMs === "number") this.maxJitterMs = maxJitterMs;
    this.start();
  }

  public getTask(): ScheduledTask | null {
    return this.job;
  }

  private getJitterDelay(): number {
    if (this.maxJitterMs <= 0) return 0;
    // deterministic per schedule, based on schedule id hash
    const hash = this.hashString(this.id);
    return hash % this.maxJitterMs;
  }

  private async tryLock(): Promise<boolean> {
    const result = await this.redis.set(
      this.lockKey,
      "locked",
      "NX",
      "PX",
      this.lockTtlMs
    );

    return result === "OK";
  }

  private async unlock(): Promise<void> {
    try {
      await this.redis.del(this.lockKey);
    } catch (err) {
      // swallow unlock errors; logging left to caller
      // eslint-disable-next-line no-console
      console.error(`[redis-distro-scheduler:${this.name}] unlock failed`, err);
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}
