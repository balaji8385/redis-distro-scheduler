
# redis-distro-scheduler

Distributed, Redis-backed cron scheduler with **multi-tenant guardrails** and **jitter**,  
designed for Node.js 24 and TypeScript.

- ✅ Works across **multiple pods / processes** (Redis lock)
- ✅ **Dynamic** create / update / delete of schedules (no restart)
- ✅ **Per-tenant guardrails** (limit schedules, enforce min interval)
- ✅ **Jitter** to avoid thundering herd on the same second
- ✅ First-class **TypeScript** support

## Installation

```bash
npm install redis-distro-scheduler
# or
yarn add redis-distro-scheduler
```

## Basic Concepts

- A **schedule** is a row in your DB (per customer) that defines:
  - `cronExpression`
  - `timezone`
  - report payload (what to generate, recipients, filters, etc.)
- Each schedule is executed by the library via a **Scheduler** instance.
- **SchedulerManager** keeps all schedulers in memory and reacts to:
  - initial load from DB
  - create / update / delete events (e.g. via Redis Pub/Sub)
- Redis is used as a **distributed lock**, so only **one pod** runs a job per tick.

## Quick Start

### 1. Define your `ScheduleRecord` source (DB)

```ts
import type { ScheduleRecord } from "redis-distro-scheduler";

// Example structure (you likely already have something similar in your DB)
// interface ScheduleRecord {
//   id: string;
//   customerId: string;
//   name: string;
//   cronExpression: string;
//   timezone?: string;
//   payload: any;
//   enabled: boolean;
// }
```

### 2. Create a `SchedulerManager` in each app pod

```ts
import { SchedulerManager, type ScheduleRecord } from "redis-distro-scheduler";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);
const sub = redis.duplicate();

async function fetchAllEnabledSchedules(): Promise<ScheduleRecord[]> {
  // SELECT * FROM report_schedules WHERE enabled = 1;
  return [];
}

async function runReport(schedule: ScheduleRecord): Promise<void> {
  // Your business logic:
  //  - Generate report
  //  - Send email
  //  - Store file / etc.
  console.log("Running report for schedule", schedule.id);
}

const manager = new SchedulerManager({
  redis,
  runReport,
  defaultMaxJitterMs: 30_000, // spread executions up to 30s per schedule
});

// On startup
await manager.loadInitialSchedules(await fetchAllEnabledSchedules);
```

### 3. React to create / update / delete via Redis Pub/Sub (or any bus likr rabbitmq/sqs etc.)

```ts
type ScheduleEvent =
  | { type: "created" | "updated"; schedule: ScheduleRecord }
  | { type: "deleted"; scheduleId: string };

await sub.subscribe("report-schedules");

sub.on("message", (_channel, msg) => {
  const event: ScheduleEvent = JSON.parse(msg);

  switch (event.type) {
    case "created":
    case "updated":
      manager.upsertSchedule(event.schedule);
      break;
    case "deleted":
      manager.removeSchedule(event.scheduleId);
      break;
  }
});
```

From your API service, after writing to DB:

```ts
// example: create or update a schedule
await redis.publish(
  "report-schedules",
  JSON.stringify({ type: "updated", schedule: savedSchedule })
);
```

### 4. Tenancy guardrails

Use `ensureMinimumInterval` to enforce per-tenant cron frequency limits:

```ts
import {
  DEFAULT_TENANT_GUARDRAILS,
  ensureMinimumInterval,
} from "redis-distro-scheduler";

async function validateScheduleBeforeSave(input: {
  cronExpression: string;
  timezone?: string;
  customerId: string;
}) {
  // Example: enforce minimum interval
  ensureMinimumInterval(
    input.cronExpression,
    input.timezone,
    DEFAULT_TENANT_GUARDRAILS.MIN_INTERVAL_MINUTES
  );

  // Example: count active schedules in DB and compare to
  // DEFAULT_TENANT_GUARDRAILS.MAX_ACTIVE_SCHEDULES_PER_CUSTOMER
}
```

### 5. Jitter and locking

- Each schedule has a dedicated Redis key:

  ```txt
  redis-distro-scheduler:report:<scheduleId>:lock
  ```

- At each cron tick:
  1. All pods try `SET key "locked" NX PX <ttl>`.
  2. Only **one** pod gets `"OK"` and runs the job.
  3. That pod waits a **deterministic jitter** based on schedule ID, up to `maxJitterMs`.
  4. It then executes your `runReport(schedule)` callback.

## API Overview

### `Scheduler`

Low-level class, usually managed by `SchedulerManager`.

```ts
import { Scheduler } from "redis-distro-scheduler";

const scheduler = new Scheduler({
  scheduleId: "uuid-123",
  name: "nightly-report",
  cronExpression: "0 2 * * *", // every day at 02:00
  timezone: "America/New_York",
  redis,
  maxJitterMs: 30_000,
  callback: async () => {
    console.log("Running nightly report...");
  },
});
```

Methods:

- `start()` — (re)start cron
- `stop()` — stop cron
- `update(cronExpression, timezone?, maxJitterMs?)` — update schedule on the fly

### `SchedulerManager`

High-level orchestrator for many schedules.

```ts
const manager = new SchedulerManager({
  redis,
  runReport: async (schedule) => {
    // ...
  },
});

await manager.loadInitialSchedules(fetchAllEnabled);

// React to events:
manager.upsertSchedule(schedule);  // create or update
manager.removeSchedule(id);        // delete / disable
```

### Tenant guardrails utilities

```ts
import {
  DEFAULT_TENANT_GUARDRAILS,
  ensureMinimumInterval,
  type TenantGuardrailsConfig,
} from "redis-distro-scheduler";
```

## Node.js and TypeScript

- Written in TypeScript, compiled to ESM + CJS.
- Tested with **Node.js 24**.
- Ships with type declarations (`.d.ts`).

## Testing

This package uses [Vitest](https://vitest.dev/) for unit tests.

```bash
npm test
```

## License

MIT
