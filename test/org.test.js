// The repository lives at zubra-js/zubra-ui. Its site's address comes from the organization the
// Pages workflow runs in, so the only places the old one could come back are written by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('nothing names the organization the repository moved from', () => {
  const old = ['journey', 'to', 'code', 'org'].join('-');
  let found = '';
  try {
    found = execFileSync('git', ['grep', '-I', '-n', '-e', `${old}/zubra`, '-e', `${old}.github.io/zubra`], { cwd: root, encoding: 'utf8' });
  } catch (error) {
    if (error.status !== 1) throw error; // 1: no match
  }
  assert.equal(found, '', 'use zubra-js/zubra, zubra-js/zubra-ui and zubra-js.github.io');
});
