import {
  exercise,
  summarize,
  thresholds,
  trendStats,
  numberSetting,
} from './common.js';
export const options = {
  scenarios: {
    steady: {
      executor: 'constant-arrival-rate',
      rate: numberSetting('ITERATIONS_PER_SECOND', 20),
      timeUnit: '1s',
      duration: __ENV.DURATION ?? '120s',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds,
  summaryTrendStats: trendStats,
};
export default exercise;
export const handleSummary = summarize;
