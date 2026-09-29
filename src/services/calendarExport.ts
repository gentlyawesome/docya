import Share from 'react-native-share';
import { Booking } from '../types';
import { toBase64 } from '../utils/base64';
import { buildIcs, icsFilename } from '../utils/ics';
import { logError } from '../utils/logger';

export type CalendarExportResult = 'shared' | 'dismissed' | 'error';

// Hands an .ics file to the iOS share sheet, which offers "Add to Calendar".
// No calendar permission is needed because the user picks the destination.
export const addToCalendar = async (booking: Booking): Promise<CalendarExportResult> => {
  try {
    const result = await Share.open({
      url: `data:text/calendar;base64,${toBase64(buildIcs(booking))}`,
      type: 'text/calendar',
      filename: icsFilename(booking),
      failOnCancel: false,
    });
    return result?.dismissedAction ? 'dismissed' : 'shared';
  } catch (error) {
    logError('Failed to open the share sheet:', error);
    return 'error';
  }
};
