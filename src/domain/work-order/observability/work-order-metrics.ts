export interface WorkOrderMetrics {
  recordCreated(): void;
  recordStatusChange(fromStatus: string, toStatus: string, durationSeconds?: number): void;
}

export const noopWorkOrderMetrics: WorkOrderMetrics = {
  recordCreated(): void {
    // intentionally empty
  },
  recordStatusChange(): void {
    // intentionally empty
  },
};
