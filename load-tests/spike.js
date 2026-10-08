import {
  pacedExercise,
  summarize,
  thresholds,
  trendStats,
  numberSetting,
} from './common.js';
export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '5s', target: numberSetting('MAX_VUS', 100) },
    { duration: '30s', target: numberSetting('MAX_VUS', 100) },
    { duration: '5s', target: 5 },
    { duration: '20s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds,
  summaryTrendStats: trendStats,
};
export default pacedExercise;
export const handleSummary = summarize;
