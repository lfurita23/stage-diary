export type SharedEvent = { title: string; theater: string; date: string; timeHour: string; timeMin: string };

export function parseSharedEvent(raw: string): SharedEvent | null {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const { title, theater, date, timeHour, timeMin } = value;
    if (typeof title !== 'string' || !title.trim() || title.length > 200 || typeof theater !== 'string' || !theater.trim() || theater.length > 200) return null;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return null;
    if (typeof timeHour !== 'string' || !/^(?:[01]\d|2[0-3])$/.test(timeHour) || typeof timeMin !== 'string' || !/^[0-5]\d$/.test(timeMin)) return null;
    return { title: title.trim(), theater: theater.trim(), date, timeHour, timeMin };
  } catch { return null; }
}

export function calendarFile(event: SharedEvent): string {
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const start = new Date(`${event.date}T${event.timeHour}:${event.timeMin}:00+09:00`);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = `${event.date.replaceAll('-', '')}-${event.timeHour}${event.timeMin}-${Array.from(event.title + event.theater).map(c => c.codePointAt(0)!.toString(16)).join('')}@stage-diary`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stage Diary//Calendar//KO', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `SUMMARY:${escape(event.title)}`, `LOCATION:${escape(event.theater)}`, 'DESCRIPTION:함께 보는 공연 일정 (한국 시간). 종료 시간은 공연 안내를 확인해주세요.', 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:내일 공연 일정이 있습니다.', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  // RFC 5545: fold at 75 UTF-8 octets, without splitting a character.
  return lines.map(line => {
    let folded = '', length = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (length + size > 75) { folded += '\r\n '; length = 1; }
      folded += char; length += size;
    }
    return folded;
  }).join('\r\n') + '\r\n';
}
