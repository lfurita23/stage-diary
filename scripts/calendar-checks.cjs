const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSharedEvent, calendarFile } = require('./load-calendar.cjs');
const event = { title: '함께 보는 공연', theater: '서울 공연장', date: '2026-11-20', timeHour: '19', timeMin: '30' };
test('shared data rejects invalid dates/times and drops private ticket fields', () => {
  const parsed = parseSharedEvent(JSON.stringify({ ...event, phone_suffix: '1234', transfer_image: 'private', memo: 'private' }));
  assert.deepEqual(Object.keys(parsed), Object.keys(event));
  for (const patch of [{ date: '2026-02-30' }, { timeHour: '24' }, { timeMin: '60' }, { title: '' }]) assert.equal(parseSharedEvent(JSON.stringify({ ...event, ...patch })), null);
  assert.equal(parseSharedEvent('not-json'), null);
});
test('ICS uses Korean time, alarm, stable UID, escaped values and UTF-8 line folding', () => {
  const file = calendarFile({ ...event, title: '공연,제목;\n'.repeat(30) });
  assert.match(file, /DTSTART:20261120T103000Z/);
  assert.match(file, /TRIGGER:-P1D/);
  assert.match(file, /\\,제목\\;\\n/);
  for (const line of file.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  const unfolded = file.replace(/\r\n /g, '');
  assert.equal(unfolded.match(/^BEGIN:VEVENT$/gm).length, 1);
  assert.equal(calendarFile(event).match(/UID:.+/)[0], calendarFile(event).match(/UID:.+/)[0]);
});
