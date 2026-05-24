'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pickAdvice, currentSeason } = require('../lib/copy-bank');

const sampleBank = {
  yes: {
    summer: ['A', 'B', 'C', 'D'],
    spring: ['S1', 'S2'],
    autumn: ['F1'],
    winter: ['W1', 'W2', 'W3'],
  },
  maybe: { summer: [], spring: ['M'], autumn: ['MF'], winter: ['MW'] },
  no:    { summer: ['N1'], spring: ['NS'], autumn: ['NF'], winter: ['NW'] },
};

test('currentSeason returns a valid season string', () => {
  const s = currentSeason();
  assert.ok(['spring', 'summer', 'autumn', 'winter'].includes(s));
});

test('pickAdvice returns an advice and index from the right status/season bucket', () => {
  const { advice, index } = pickAdvice('yes', sampleBank, -1);
  const season = currentSeason();
  const bucket = sampleBank.yes[season];
  if (bucket.length > 0) {
    assert.ok(bucket.includes(advice), `picked ${advice} not in bucket`);
    assert.ok(index >= 0 && index < bucket.length);
  } else {
    assert.equal(advice, '');
    assert.equal(index, -1);
  }
});

test('pickAdvice with an empty bucket returns empty string and -1', () => {
  const empty = { yes: { summer: [], spring: [], autumn: [], winter: [] } };
  const { advice, index } = pickAdvice('yes', empty, -1);
  assert.equal(advice, '');
  assert.equal(index, -1);
});

test('pickAdvice with an unknown status returns empty string and -1', () => {
  const { advice, index } = pickAdvice('unknown', sampleBank, -1);
  assert.equal(advice, '');
  assert.equal(index, -1);
});

test('pickAdvice with a single-item bucket returns that item without looping', () => {
  const single = { yes: { summer: ['ONLY'], spring: ['ONLY'], autumn: ['ONLY'], winter: ['ONLY'] } };
  const { advice, index } = pickAdvice('yes', single, -1);
  assert.equal(advice, 'ONLY');
  assert.equal(index, 0);
});

// Builds a bank where the current-season bucket has more than one item,
// regardless of the calendar date. This keeps the test season-independent.
function bankWithMultiItemSeason() {
  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  const yes = {};
  for (const s of seasons) yes[s] = ['A', 'B', 'C', 'D'];
  return { yes };
}

test('pickAdvice tries to skip lastIndex when the bucket has more than one item', () => {
  const bank = bankWithMultiItemSeason();
  let sawDifferent = false;
  for (let i = 0; i < 100; i++) {
    const { index } = pickAdvice('yes', bank, 0);
    if (index !== 0) { sawDifferent = true; break; }
  }
  assert.ok(sawDifferent, 'pickAdvice should occasionally pick a non-lastIndex value');
});
