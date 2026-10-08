import { pacedExercise, summarize, thresholds, trendStats } from './common.js';
export const options = {
  vus: 1,
  duration: __ENV.DURATION ?? '10s',
  thresholds,
  summaryTrendStats: trendStats,
};
export default pacedExercise;
export const handleSummary = summarize;
