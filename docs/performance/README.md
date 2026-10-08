# Benchmark artifacts

verification.json contains actual local verification attempts and blockers. It is not a benchmark.

Successful db:explain runs create baseline-_.txt and candidate-_.txt from PostgreSQL itself. k6 runs create baseline-<run>.json, optimized-<run>.json and redis-<run>.json. No plan/latency artifacts are fabricated when execution is unavailable. Candidate plans are not evidence of an optimized API until an evaluated change is applied and measured.
