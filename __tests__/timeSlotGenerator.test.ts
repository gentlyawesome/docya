import {
  parseTimeString,
  generateTimeSlotsFromRange,
  formatTime12Hour,
} from '../src/utils/timeSlotGenerator';

describe('timeSlotGenerator', () => {
  describe('parseTimeString', () => {
    it('should parse AM time correctly', () => {
      expect(parseTimeString(' 9:00AM')).toBe('09:00');
      expect(parseTimeString('10:00AM')).toBe('10:00');
    });

    it('should parse PM time correctly', () => {
      expect(parseTimeString(' 2:00PM')).toBe('14:00');
      expect(parseTimeString(' 5:30PM')).toBe('17:30');
    });

    it('should handle 12-hour times', () => {
      expect(parseTimeString('12:00PM')).toBe('12:00');
      expect(parseTimeString('12:00AM')).toBe('00:00');
    });
  });

  describe('generateTimeSlotsFromRange', () => {
    it('should generate 30-minute slots', () => {
      const slots = generateTimeSlotsFromRange(
        ' 9:00AM',
        '10:00AM',
        'doctor-1',
        'Dr. Test',
        'Monday',
        'UTC',
        '2024-01-01',
        []
      );

      expect(slots).toHaveLength(2);
      expect(slots[0].startTime).toBe('09:00');
      expect(slots[0].endTime).toBe('09:30');
      expect(slots[1].startTime).toBe('09:30');
      expect(slots[1].endTime).toBe('10:00');
    });

    it('should mark booked slots correctly', () => {
      const bookedSlots = [
        {
          id: 'booking-1',
          doctorId: 'doctor-1',
          doctorName: 'Dr. Test',
          date: '2024-01-01',
          startTime: '09:00',
          endTime: '09:30',
          dayOfWeek: 'Monday',
          timezone: 'UTC',
          bookedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const slots = generateTimeSlotsFromRange(
        ' 9:00AM',
        '10:00AM',
        'doctor-1',
        'Dr. Test',
        'Monday',
        'UTC',
        '2024-01-01',
        bookedSlots
      );

      expect(slots[0].isBooked).toBe(true);
      expect(slots[1].isBooked).toBe(false);
    });

    it('should not mark slots as booked for different dates', () => {
      const bookedSlots = [
        {
          id: 'booking-1',
          doctorId: 'doctor-1',
          doctorName: 'Dr. Test',
          date: '2024-01-02',
          startTime: '09:00',
          endTime: '09:30',
          dayOfWeek: 'Tuesday',
          timezone: 'UTC',
          bookedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const slots = generateTimeSlotsFromRange(
        ' 9:00AM',
        '10:00AM',
        'doctor-1',
        'Dr. Test',
        'Monday',
        'UTC',
        '2024-01-01',
        bookedSlots
      );

      expect(slots[0].isBooked).toBe(false);
    });
  });

  describe('formatTime12Hour', () => {
    it('should format 24-hour time to 12-hour format', () => {
      expect(formatTime12Hour('09:00')).toBe('9:00 AM');
      expect(formatTime12Hour('14:30')).toBe('2:30 PM');
      expect(formatTime12Hour('00:00')).toBe('12:00 AM');
      expect(formatTime12Hour('12:00')).toBe('12:00 PM');
    });
  });
});
