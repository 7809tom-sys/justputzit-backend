export type SafetyReportForEscalation = {
  reporterId: number;
  status: "pending" | "reviewed" | "actioned" | "dismissed";
};

export function shouldAutoSuspendForReports(
  targetRole: string | null | undefined,
  reports: readonly SafetyReportForEscalation[],
  threshold = 3,
) {
  if (targetRole !== "user") return false;
  const distinctOpenReporters = new Set(
    reports.filter((report) => report.status !== "dismissed").map((report) => report.reporterId),
  );
  return distinctOpenReporters.size >= threshold;
}
