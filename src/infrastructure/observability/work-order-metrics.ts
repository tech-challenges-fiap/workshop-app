import {
  workOrderCreatedCounter,
  workOrderStatusChangeCounter,
  workOrderDurationHistogram,
  integrationErrorCounter,
} from "./telemetry";

export function recordWorkOrderCreated(): void {
  workOrderCreatedCounter.add(1);
}

export function recordWorkOrderStatusChange(
  fromStatus: string,
  toStatus: string,
  durationSeconds?: number,
): void {
  workOrderStatusChangeCounter.add(1, {
    from_status: fromStatus,
    to_status: toStatus,
  });

  if (durationSeconds !== undefined && durationSeconds >= 0) {
    workOrderDurationHistogram.record(durationSeconds, {
      status: fromStatus,
    });
  }
}

export function recordIntegrationError(target: string): void {
  integrationErrorCounter.add(1, { target });
}
