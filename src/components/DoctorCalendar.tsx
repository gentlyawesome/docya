import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { addDays, format } from 'date-fns';
import { COLORS } from '../constants';
import { haptics } from '../utils/haptics';

interface DoctorCalendarProps {
  selectedDate: string;
  availableDates?: string[];
  onDateSelect: (date: string) => void;
  windowDays?: number;
}

export const DoctorCalendar: React.FC<DoctorCalendarProps> = ({
  selectedDate,
  availableDates = [],
  onDateSelect,
  windowDays = 14,
}) => {
  const { minDate, maxDate } = useMemo(() => {
    const today = new Date();
    return {
      minDate: format(today, 'yyyy-MM-dd'),
      maxDate: format(addDays(today, windowDays - 1), 'yyyy-MM-dd'),
    };
  }, [windowDays]);

  const markedDates = useMemo(() => {
    const marks: Record<string, object> = {};
    availableDates.forEach(date => {
      marks[date] = { marked: true, dotColor: COLORS.success };
    });
    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: COLORS.primary,
    };
    return marks;
  }, [availableDates, selectedDate]);

  return (
    <View style={styles.container}>
      <Calendar
        testID="doctor-calendar"
        current={selectedDate}
        minDate={minDate}
        maxDate={maxDate}
        markedDates={markedDates}
        onDayPress={day => {
          haptics.selection();
          onDateSelect(day.dateString);
        }}
        disableAllTouchEventsForDisabledDays
        renderArrow={direction => (
          <Text style={styles.arrow} accessibilityElementsHidden importantForAccessibility="no">
            {direction === 'left' ? '‹' : '›'}
          </Text>
        )}
        theme={{
          calendarBackground: COLORS.card,
          todayTextColor: COLORS.primary,
          selectedDayBackgroundColor: COLORS.primary,
          selectedDayTextColor: '#FFFFFF',
          arrowColor: COLORS.primary,
          textDisabledColor: COLORS.disabled,
          dayTextColor: COLORS.text,
          monthTextColor: COLORS.text,
          textMonthFontWeight: '600',
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  arrow: {
    fontSize: 32,
    lineHeight: 34,
    color: COLORS.primary,
    paddingHorizontal: 8,
  },
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
