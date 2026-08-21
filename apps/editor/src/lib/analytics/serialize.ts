import { analyticsReportingLeaksSensitiveMaterial } from "@magazine/domain";

export function assertSafeAnalyticsDto(payload: unknown): void {
  if (analyticsReportingLeaksSensitiveMaterial(payload)) {
    throw new Error("Analytics response leaked sensitive material.");
  }
}
