import { Booking } from '../types';
import { getBookingEnd, getSlotStart } from './bookingPhases';
import { formatTimezone } from './dateHelpers';
import { utf8Bytes } from './base64';

const pad = (n: number) => String(n).padStart(2, '0');

const toIcsUtc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
  `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

const escapeText = (text: string) =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// RFC 5545: lines are limited to 75 octets; continuation lines start with a space
const foldLine = (line: string): string => {
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  let limit = 75;
  for (const char of line) {
    const size = utf8Bytes(char).length;
    if (currentBytes + size > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
};

export const buildIcs = (booking: Booking, now: Date = new Date()): string => {
  const start = getSlotStart(booking.date, booking.startTime, booking.timezone);
  const end = getBookingEnd(booking);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Docya//Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@docya`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeText(`Appointment with ${booking.doctorName}`)}`,
    `DESCRIPTION:${escapeText(
      `${minutes}-minute appointment with ${booking.doctorName} (${formatTimezone(
        booking.timezone
      )} time).`
    )}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join('\r\n') + '\r\n';
};

export const icsFilename = (booking: Booking): string => {
  const slug = booking.doctorName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `appointment-${slug || 'doctor'}-${booking.date}.ics`;
};
