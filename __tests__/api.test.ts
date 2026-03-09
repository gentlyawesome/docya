import { transformToDoctors } from '../src/services/api';
import { DoctorAvailability } from '../src/types';

describe('API Service', () => {
  describe('transformToDoctors', () => {
    it('should group availabilities by doctor name', () => {
      const availabilities: DoctorAvailability[] = [
        {
          name: 'Dr. John Doe',
          timezone: 'Australia/Sydney',
          day_of_week: 'Monday',
          available_at: ' 9:00AM',
          available_until: ' 5:00PM',
        },
        {
          name: 'Dr. John Doe',
          timezone: 'Australia/Sydney',
          day_of_week: 'Tuesday',
          available_at: '10:00AM',
          available_until: ' 4:00PM',
        },
        {
          name: 'Dr. Jane Smith',
          timezone: 'Australia/Perth',
          day_of_week: 'Monday',
          available_at: ' 8:00AM',
          available_until: '12:00PM',
        },
      ];

      const doctors = transformToDoctors(availabilities);

      expect(doctors).toHaveLength(2);
      expect(doctors[0].name).toBe('Dr. Jane Smith');
      expect(doctors[1].name).toBe('Dr. John Doe');
    });

    it('should generate unique IDs for doctors', () => {
      const availabilities: DoctorAvailability[] = [
        {
          name: 'Dr. John Doe',
          timezone: 'Australia/Sydney',
          day_of_week: 'Monday',
          available_at: ' 9:00AM',
          available_until: ' 5:00PM',
        },
      ];

      const doctors = transformToDoctors(availabilities);

      expect(doctors[0].id).toBe('dr-john-doe');
    });

    it('should preserve all availabilities for each doctor', () => {
      const availabilities: DoctorAvailability[] = [
        {
          name: 'Dr. John Doe',
          timezone: 'Australia/Sydney',
          day_of_week: 'Monday',
          available_at: ' 9:00AM',
          available_until: ' 5:00PM',
        },
        {
          name: 'Dr. John Doe',
          timezone: 'Australia/Sydney',
          day_of_week: 'Tuesday',
          available_at: '10:00AM',
          available_until: ' 4:00PM',
        },
      ];

      const doctors = transformToDoctors(availabilities);

      expect(doctors[0].availabilities).toHaveLength(2);
      expect(doctors[0].availabilities[0].day_of_week).toBe('Monday');
      expect(doctors[0].availabilities[1].day_of_week).toBe('Tuesday');
    });

    it('should use first availability timezone as doctor timezone', () => {
      const availabilities: DoctorAvailability[] = [
        {
          name: 'Dr. John Doe',
          timezone: 'Australia/Sydney',
          day_of_week: 'Monday',
          available_at: ' 9:00AM',
          available_until: ' 5:00PM',
        },
      ];

      const doctors = transformToDoctors(availabilities);

      expect(doctors[0].timezone).toBe('Australia/Sydney');
    });

    it('should sort doctors alphabetically by name', () => {
      const availabilities: DoctorAvailability[] = [
        {
          name: 'Dr. Zoe',
          timezone: 'UTC',
          day_of_week: 'Monday',
          available_at: ' 9:00AM',
          available_until: ' 5:00PM',
        },
        {
          name: 'Dr. Alice',
          timezone: 'UTC',
          day_of_week: 'Monday',
          available_at: ' 9:00AM',
          available_until: ' 5:00PM',
        },
        {
          name: 'Dr. Bob',
          timezone: 'UTC',
          day_of_week: 'Monday',
          available_at: ' 9:00AM',
          available_until: ' 5:00PM',
        },
      ];

      const doctors = transformToDoctors(availabilities);

      expect(doctors[0].name).toBe('Dr. Alice');
      expect(doctors[1].name).toBe('Dr. Bob');
      expect(doctors[2].name).toBe('Dr. Zoe');
    });
  });
});
