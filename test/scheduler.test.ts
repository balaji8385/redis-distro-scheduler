import { describe, it, expect, vi } from "vitest";

// Mock node-cron so we can synchronously trigger the scheduled callback.
vi.mock("node-cron", () => {
  return {
    default: {
      schedule: (expression: string, fn: () => Promise<void> | void, _opts: any) => {
        const task = {
          expression,
          fn,
          start: vi.fn(),
          stop: vi.fn(),
          run: fn, // custom helper used in test
        };
        return task;
      },
    },
    schedule: (expression: string, fn: () => Promise<void> | void, _opts: any) => {
      const task = {
        expression,
        fn,
        start: vi.fn(),
        stop: vi.fn(),
        run: fn,
      };
      return task;
    },
  };
});

import { Scheduler } from "../src/scheduler";
import type { RedisLike } from "../src/types";

class FakeRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async set(
    key: string,
    value: string,
    mode?: "NX" | "XX",
    px?: "PX",
    ttlMs?: number
  ): Promise<"OK" | null> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (existing && existing.expiresAt && existing.expiresAt <= now) {
      this.store.delete(key);
    }

    if (mode === "NX") {
      if (this.store.has(key)) {
        return null;
      }
    }

    const expiresAt =
      px === "PX" && typeof ttlMs === "number" ? now + ttlMs : undefined;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }
}

describe("Scheduler", () => {
  it("runs callback when lock is acquired", async () => {
    const redis = new FakeRedis();
    const cb = vi.fn();

    const scheduler = new Scheduler({
      scheduleId: "sch-1",
      name: "test-scheduler",
      cronExpression: "* * * * * *",
      redis,
      callback: cb,
      maxJitterMs: 0,
      lockTtlMs: 1000,
    });

    const task: any = scheduler.getTask();
    expect(task).toBeTruthy();

    // simulate a cron tick
    await task.run();

    expect(cb).toHaveBeenCalledTimes(1);
  });
});
