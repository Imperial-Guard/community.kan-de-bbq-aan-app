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

test('currentSeason returnt valid season string', () => {
  const s = currentSeason();
  assert.ok(['spring', 'summer', 'autumn', 'winter'].includes(s));
});

test('pickAdvice returnt string + index uit de juiste status/season bucket', () => {
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

test('pickAdvice met lege bucket returnt empty + -1', () => {
  const empty = { yes: { summer: [], spring: [], autumn: [], winter: [] } };
  const { advice, index } = pickAdvice('yes', empty, -1);
  assert.equal(advice, '');
  assert.equal(index, -1);
});

test('pickAdvice met ontbrekende status returnt empty + -1', () => {
  const { advice, index } = pickAdvice('unknown', sampleBank, -1);
  assert.equal(advice, '');
  assert.equal(index, -1);
});

test('pickAdvice met enkele item bucket retourneert dat item (zonder loop)', () => {
  const single = { yes: { summer: ['ONLY'], spring: ['ONLY'], autumn: ['ONLY'], winter: ['ONLY'] } };
  const { advice, index } = pickAdvice('yes', single, -1);
  assert.equal(advice, 'ONLY');
  assert.equal(index, 0);
});

test('pickAdvice probeert lastIndex te skippen wanneer bucket >1 items heeft', () => {
  // Met een bucket van 4 items, en lastIndex bekend, geef de pick een kans om af te wijken
  // We runnen 100x en checken dat we niet 100% lastIndex krijgen
  const bucket = sampleBank.yes.summer; // 4 items
  if (currentSeason() !== 'summer') {
    // Test is alleen relevant als season=summer
    return;
  }
  let sawDifferent = false;
  for (let i = 0; i < 100; i++) {
    const { index } = pickAdvice('yes', sampleBank, 0);
    if (index !== 0) { sawDifferent = true; break; }
  }
  assert.ok(sawDifferent, 'pickAdvice should occasionally pick non-lastIndex');
});
