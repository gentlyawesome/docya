import { getBookingPhase } from '../src/utils/bookingPhases';
import { filterFutureSlots } from '../src/utils/timeSlotGenerator';
import { booking, slot } from './helpers/testStore';

describe('booking phases', () => {
  // 09:30 in Perth (UTC+8) on 2026-10-01 is 01:30 UTC
  const endUtc = Date.UTC(2026, 9, 1, 1, 30);
  const day = booking({ date: '2026-10-01' });

  it('uses the doctor time zone to decide when an appointment has ended', () => {
    expect(getBookingPhase(day, endUtc - 60_000)).toBe('upcoming');
    expect(getBookingPhase(day, endUtc + 60_000)).toBe('completed');
  });

  it('honours cancelled and completed statuses regardless of time', () => {
    expect(
      getBookingPhase({ ...day, status: 'cancelled' }, endUtc - 60_000),
    ).toBe('cancelled');
    expect(
      getBookingPhase({ ...day, status: 'completed' }, endUtc - 60_000),
    ).toBe('completed');
    expect(
      getBookingPhase({ ...day, status: undefined }, endUtc - 60_000),
    ).toBe('upcoming');
  });
});

describe('filterFutureSlots', () => {
  const at = (startTime: string) => ({
    ...slot,
    date: '2026-10-01',
    startTime,
  });

  it('drops slots that already started, judged in the doctor time zone', () => {
    // 09:15 Perth (UTC+8) = 01:15 UTC
    const now = Date.UTC(2026, 9, 1, 1, 15);
    const kept = filterFutureSlots(
      [at('08:30'), at('09:00'), at('09:30'), at('10:00')],
      now,
    );
    expect(kept.map(s => s.startTime)).toEqual(['09:30', '10:00']);
  });
});
