
import { CronExpressionParser } from "cron-parser";

export interface TenantGuardrailsConfig {
  MAX_ACTIVE_SCHEDULES_PER_CUSTOMER: number;
  MIN_INTERVAL_MINUTES: number;
}

export const DEFAULT_TENANT_GUARDRAILS: TenantGuardrailsConfig = {
  MAX_ACTIVE_SCHEDULES_PER_CUSTOMER: 20,
  MIN_INTERVAL_MINUTES: 5,
};

export function ensureMinimumInterval(
  cronExpression: string,
  timezone: string | undefined,
  minMinutes: number
): void {
  const iter = CronExpressionParser.parse(cronExpression, {
    tz: timezone || "UTC",
  });

  const first = iter.next().getTime();
  const second = iter.next().getTime();

  const diffMs = second - first;
  const diffMinutes = diffMs / 60000;

  if (diffMinutes < minMinutes) {
    throw new Error(
      `Cron expression is too frequent. Minimum allowed interval is ${minMinutes} minutes.`
    );
  }
}
