import { User } from '../types';
import { listMyAppointments } from './appointmentsService';
import { listMyAvailability } from './availabilityService';
import { getDoctorProfile } from './userService';

// Everything Docya holds about the signed-in doctor, as readable JSON (a copy for the doctor to keep)
export const buildDataExport = async (user: User): Promise<string> => {
  const [doctorProfile, workingHours, appointments] = await Promise.all([
    getDoctorProfile(user.id),
    listMyAvailability(user.id),
    listMyAppointments(),
  ]);
  return JSON.stringify(
    {
      app: 'Docya',
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? null,
        specialization: doctorProfile?.specialization ?? null,
        timeZone: doctorProfile?.timezone ?? null,
      },
      workingHours: workingHours.map(w => ({
        day: w.dayOfWeek,
        from: w.startTime,
        to: w.endTime,
        available: w.isAvailable,
      })),
      appointments: appointments.map(a => ({
        date: a.date,
        from: a.startTime,
        to: a.endTime,
        status: a.status ?? 'confirmed',
        patientName: a.patientName ?? null,
        patientPhone: a.patientPhone ?? null,
        notes: a.notes ?? null,
        timeZone: a.timezone,
        bookedAt: a.bookedAt,
      })),
    },
    null,
    2,
  );
};
