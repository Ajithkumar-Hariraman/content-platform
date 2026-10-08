import {
  pacedExercise,
  summarize,
  thresholds,
  trendStats,
  numberSetting,
} from './common.js';
const maximum = numberSetting('MAX_VUS', 100);
export const options = {
  stages: [
    { duration: '30s', target: Math.ceil(maximum / 4) },
    { duration: '60s', target: Math.ceil(maximum / 2) },
    { duration: '60s', target: maximum },
    { duration: '30s', target: 0 },
  ],
  thresholds,
  summaryTrendStats: trendStats,
};
export default pacedExercise;
export const handleSummary = summarize;
