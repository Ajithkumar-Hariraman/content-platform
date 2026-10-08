import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redact } from '../src/logging/redact.js';
test('diagnostic logging redacts connection URLs and encoded/plain passwords', () => {
  const message = redact(
    'connection postgresql://role:p%40ss@127.0.0.1:55433/cloudops failed secret-test p@ss p%40ss',
    {
      POSTGRES_PASSWORD: 'secret-test',
      DATABASE_URL: 'postgresql://role:p%40ss@127.0.0.1:55433/cloudops',
    },
  );
  for (const secret of ['secret-test', 'p@ss', 'p%40ss', 'role:'])
    assert.equal(message.includes(secret), false);
  assert.match(message, /connection.*failed/);
});
