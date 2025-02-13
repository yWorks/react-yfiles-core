import type { LabeledTimeInterval, TimeInterval } from './TimelineEngine'

const MONTHS: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/**
 * Yields all "days" in the given interval.
 * @yields {LabeledTimeInterval}
 */
export function* days(start: Date, end: Date): Iterable<LabeledTimeInterval> {
  const floor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const ceiling = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)

  for (let currentDate = new Date(floor); currentDate < ceiling; ) {
    const start = new Date(currentDate)
    currentDate.setDate(currentDate.getDate() + 1)
    const end = new Date(currentDate)
    yield [start, end, String(start.getDate())]
  }
}

/**
 * Yields all "weeks" in the given interval.
 * @yields {LabeledTimeInterval}
 */
export function* weeks(start: Date, end: Date): Iterable<LabeledTimeInterval> {
  const floor = new Date(start.getFullYear(), start.getMonth(), 1)
  const ceiling = new Date(end.getFullYear(), end.getMonth() + 1, 1)

  let week = 1
  for (let currentDate = new Date(floor); currentDate < ceiling; ) {
    const start = new Date(currentDate)
    const label = String(week)
    currentDate.setDate(currentDate.getDate() + 7)
    if (
      currentDate.getMonth() > start.getMonth() ||
      currentDate.getFullYear() > start.getFullYear() /* Dec -> Jan */
    ) {
      currentDate.setDate(1)
      week = 0
    }
    const end = new Date(currentDate)
    yield [start, end, label]
    week++
  }
}

/**
 * Yields all "months" in the given interval.
 * @yields {LabeledTimeInterval}
 */
export function* months(start: Date, end: Date): Iterable<LabeledTimeInterval> {
  const floor = new Date(start.getFullYear(), start.getMonth(), 1)
  const ceiling = new Date(end.getFullYear(), end.getMonth() + 1, 1)

  for (let currentDate = new Date(floor); currentDate < ceiling; ) {
    const start = new Date(currentDate)
    currentDate.setMonth(currentDate.getMonth() + 1)
    const end = new Date(currentDate)
    yield [start, end, MONTHS[start.getMonth()]]
  }
}

/**
 * Yields all "years" in the given interval.
 * @yields {LabeledTimeInterval}
 */
export function* years(start: Date, end: Date): Iterable<LabeledTimeInterval> {
  const floor = new Date(start.getFullYear(), 0, 1)
  const ceiling = new Date(end.getFullYear() + 1, 0, 1)

  for (let currentDate = new Date(floor); currentDate < ceiling; ) {
    const start = new Date(currentDate)
    currentDate.setFullYear(currentDate.getFullYear() + 1)
    const end = new Date(currentDate)
    yield [start, end, String(start.getFullYear())]
  }
}

export function* allTime(start?: Date, end?: Date): Iterable<LabeledTimeInterval> {
  yield [start ?? new Date(Date.UTC(0, 0)), end ?? new Date(Date.UTC(5000, 0)), 'All Time']
}

export function intervalsIntersect<T extends number | Date>(
  start1: T,
  end1: T,
  start2: T,
  end2: T
): boolean {
  return !(end1 <= start2 || start1 >= end2)
}

export function timeframeEquals(
  [start1, end1]: TimeInterval,
  [start2, end2]: TimeInterval
): boolean {
  return start1.getTime() === start2.getTime() && end1.getTime() === end2.getTime()
}
