export type SponsoredPerformanceCounts = {
  views: number;
  clicks: number;
  signUps: number;
};

export function getSponsoredPerformanceRates(metrics: SponsoredPerformanceCounts) {
  return {
    ...metrics,
    clickThroughRate: metrics.views ? Math.round((metrics.clicks / metrics.views) * 1000) / 10 : 0,
    signUpRate: metrics.views ? Math.round((metrics.signUps / metrics.views) * 1000) / 10 : 0,
  };
}
