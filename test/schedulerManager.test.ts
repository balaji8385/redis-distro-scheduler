
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

    const manager = new SchedulerManager({
      redis,
      runReport,
      defaultMaxJitterMs: 0,
    });

    const schedule: ScheduleRecord = {
      id: "sch-1",
      customerId: "c-1",
      name: "Test",
      cronExpression: "* * * * * *",
      timezone: "UTC",
      payload: {},
      enabled: true,
    };

    await manager.loadInitialSchedules([schedule]);

    expect(manager.listActiveScheduleIds()).toEqual(["sch-1"]);

    // update
    manager.upsertSchedule({
      ...schedule,
      cronExpression: "*/2 * * * * *",
    });

    expect(manager.listActiveScheduleIds()).toEqual(["sch-1"]);

    // remove
    manager.removeSchedule("sch-1");
    expect(manager.listActiveScheduleIds()).toEqual([]);
  });
});
