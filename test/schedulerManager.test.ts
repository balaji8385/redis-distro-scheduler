
import { describe, it, expect, vi } from "vitest";
import { SchedulerManager } from "../src/schedulerManager";
import type { RedisLike, ScheduleRecord } from "../src/types";

class FakeRedis implements RedisLike {
  async set(): Promise<"OK"> {
    return "OK";
  }
  async del(): Promise<number> {
    return 1;
  }
}

describe("SchedulerManager", () => {
  it("upserts and removes schedules", async () => {
    const redis = new FakeRedis();
    const runReport = vi.fn(async () => {});

    const manager = new SchedulerManager(runReport, {
      redis,
      defaultMaxJitterMs: 0,
    });

    const schedule: ScheduleRecord = {
      id: "sch-1",
      cronExpression: "* * * * * *",
      timezone: "UTC",
    };

    await manager.loadInitialSchedules([schedule]);
    expect(manager.listActiveScheduleIds()).toEqual([schedule.id]);

    // update
    manager.upsertSchedule({
      ...schedule,
      cronExpression: "*/2 * * * * *",
    });

    expect(manager.listActiveScheduleIds()).toEqual([schedule.id]);

    // remove
    manager.removeSchedule(schedule.id);
    expect(manager.listActiveScheduleIds()).toEqual([]);
  });
});
