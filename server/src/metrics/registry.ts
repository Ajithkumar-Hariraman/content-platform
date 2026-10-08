const bounds = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000];
interface Histogram {
  count: number;
  sumMs: number;
  maxMs: number;
  buckets: number[];
}
export class Metrics {
  private counters = new Map<string, number>();
  private durations = new Map<string, Histogram>();
  increment(name: string, amount = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }
  observe(name: string, durationMs: number) {
    const current = this.durations.get(name) ?? {
      count: 0,
      sumMs: 0,
      maxMs: 0,
      buckets: bounds.map(() => 0),
    };
    current.count++;
    current.sumMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    bounds.forEach((bound, index) => {
      if (durationMs <= bound)
        current.buckets[index] = (current.buckets[index] ?? 0) + 1;
    });
    this.durations.set(name, current);
  }
  snapshot() {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        [...this.durations].map(([name, item]) => [
          name,
          {
            ...item,
            buckets: Object.fromEntries(
              bounds.map((bound, index) => [bound, item.buckets[index]]),
            ),
          },
        ]),
      ),
    };
  }
}
export const metrics = new Metrics();
