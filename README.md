# Doctora Appointments - Doctor Booking Application

A React Native mobile application for scheduling appointments with doctors. Built as part of the ShiftCare Technical Challenge.

## 📱 Features

- **Browse Doctors**: View a list of available doctors with their timezones and availability
- **Search & Filter**: Search doctors by name or location
- **View Schedules**: See doctor availability with a calendar-style interface
- **30-Minute Slots**: Book appointments in 30-minute time slots
- **Booking Management**: View and cancel your upcoming appointments
- **Persistent Storage**: Bookings are saved locally using AsyncStorage
- **Timezone Support**: All appointments display in the doctor's timezone
- **Double-Booking Prevention**: Slots are automatically marked as unavailable once booked

## 🏗️ Architecture

### Tech Stack

- **React Native** 0.84.1 (TypeScript)
- **React Navigation** v6 (Stack + Bottom Tabs)
- **Redux Toolkit** for state management
- **AsyncStorage** for local data persistence
- **Axios** for API calls
- **date-fns** for date/time manipulation
- **Jest** + **React Native Testing Library** for testing

### Project Structure

```
DoctoraAppointments/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── DoctorCard.tsx
│   │   ├── TimeSlotButton.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── ErrorMessage.tsx
│   ├── screens/             # Screen components
│   │   ├── DoctorsListScreen.tsx
│   │   ├── DoctorDetailScreen.tsx
│   │   ├── BookingConfirmationScreen.tsx
│   │   └── MyBookingsScreen.tsx
│   ├── navigation/          # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── store/               # Redux store and slices
│   │   ├── store.ts
│   │   ├── hooks.ts
│   │   └── slices/
│   │       ├── doctorsSlice.ts
│   │       └── bookingsSlice.ts
│   ├── services/            # API and storage services
│   │   ├── api.ts
│   │   └── storage.ts
│   ├── utils/               # Helper functions
│   │   ├── timeSlotGenerator.ts
│   │   └── dateHelpers.ts
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts
│   └── constants/           # App constants
│       └── index.ts
├── __tests__/               # Test files
│   ├── api.test.ts
│   └── timeSlotGenerator.test.ts
└── App.tsx                  # Root component
```

## 🚀 Setup & Installation

### Prerequisites

- **Node.js** >= 18.x
- **npm** or **yarn**
- **Xcode** (for iOS development)
- **Android Studio** (for Android development)
- **CocoaPods** (for iOS dependencies)

### Installation Steps

1. **Clone the repository**
   ```bash
   cd DoctoraAppointments
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install iOS dependencies** (macOS only)
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Run the application**

   **For iOS:**
   ```bash
   npx react-native run-ios
   ```

   **For Android:**
   ```bash
   npx react-native run-android
   ```

   **Start Metro bundler separately (if needed):**
   ```bash
   npx react-native start
   ```

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## 📖 Usage

### 1. Browse Doctors
- Open the app to see a list of available doctors
- Use the search bar to filter by name or location
- Pull down to refresh the doctor list

### 2. View Doctor Schedule
- Tap on a doctor card to view their availability
- Scroll through the next 14 days using the date selector
- Available time slots are shown in 30-minute intervals
- Booked slots are grayed out and disabled

### 3. Book an Appointment
- Tap on an available time slot
- Review the appointment details
- Tap "Confirm Booking" to complete the booking
- The appointment is saved locally

### 4. Manage Bookings
- Navigate to "My Bookings" tab
- View all upcoming appointments
- Tap "Cancel Appointment" to cancel a booking
- Pull down to refresh the bookings list

## 🔧 Key Implementation Details

### Time Slot Generation

The app converts doctor availability windows into 30-minute slots:

```typescript
// Example: 9:00AM - 5:30PM generates:
// 9:00-9:30, 9:30-10:00, 10:00-10:30, ..., 5:00-5:30
```

### Timezone Handling

- All times are displayed in the doctor's timezone
- Timezone information is preserved in bookings
- Uses `date-fns-tz` for timezone conversions

### State Management

- **doctorsSlice**: Manages doctor data, loading states, and search
- **bookingsSlice**: Handles booking CRUD operations and persistence
- Async thunks for API calls and AsyncStorage operations

### Double-Booking Prevention

- Checks existing bookings before allowing new bookings
- Slots are marked as booked in real-time
- Prevents booking the same doctor/time combination

## 🎯 Assumptions & Design Decisions

### Assumptions

1. **No Authentication**: The app assumes a single-user, non-authenticated experience
2. **Local-Only Storage**: Bookings are stored locally and not synced to a backend
3. **Timezone Display**: Times are shown in the doctor's timezone (not user's local time)
4. **Weekly Recurring Schedule**: Doctor availability repeats weekly
5. **30-Minute Slots**: All appointments are exactly 30 minutes long
6. **No Overlap**: Doctors don't have overlapping availability windows

### Design Decisions

1. **Redux Toolkit**: Chosen for robust state management with built-in best practices
2. **Bottom Tabs Navigation**: Provides easy access to main features (Doctors & Bookings)
3. **Calendar-Style UI**: Horizontal date selector for intuitive date selection
4. **Emoji Icons**: Used for simplicity instead of icon libraries
5. **AsyncStorage**: Sufficient for local-only booking persistence
6. **14-Day Window**: Shows availability for the next 2 weeks

## ⚠️ Known Limitations

### Current Limitations

1. **No Backend Sync**: Bookings are only stored locally
   - Data is lost if app is uninstalled
   - No synchronization across devices

2. **No Conflict Resolution**: 
   - Multiple devices can create conflicting bookings
   - No server-side validation

3. **Limited Timezone Support**:
   - Doesn't convert to user's local timezone
   - May be confusing for users in different timezones

4. **No Notifications**:
   - No reminders for upcoming appointments
   - No push notifications

5. **Basic Error Handling**:
   - Network errors show generic messages
   - No retry mechanisms for failed requests

6. **No Booking History**:
   - Past appointments are not displayed
   - No booking analytics or insights

## 🚀 Future Enhancements

### High Priority

1. **Backend Integration**
   - Real-time booking synchronization
   - Server-side validation and conflict resolution
   - User authentication and authorization

2. **Enhanced Timezone Support**
   - Display times in user's local timezone
   - Timezone conversion indicators
   - Multi-timezone booking support

3. **Push Notifications**
   - Appointment reminders (24h, 1h before)
   - Booking confirmations
   - Cancellation notifications

### Medium Priority

4. **Doctor Profiles**
   - Photos and bios
   - Specialties and qualifications
   - Patient reviews and ratings

5. **Advanced Booking Features**
   - Recurring appointments
   - Waitlist for fully booked slots
   - Appointment rescheduling

6. **Offline-First Architecture**
   - Queue bookings when offline
   - Sync when connection restored
   - Optimistic UI updates

### Low Priority

7. **Analytics & Insights**
   - Booking history
   - Most visited doctors
   - Appointment statistics

8. **Accessibility Improvements**
   - Screen reader support
   - High contrast mode
   - Larger text options

9. **Internationalization**
   - Multi-language support
   - Localized date/time formats
   - Currency localization (if payments added)

## 🧪 Testing Coverage

### Unit Tests

- ✅ Time slot generation logic
- ✅ API data transformation
- ✅ Date/time formatting utilities
- ✅ Booking validation

### Integration Tests

- ✅ Redux store operations
- ✅ AsyncStorage persistence
- ✅ Navigation flows

### Edge Cases Covered

- Empty API responses
- Network failures
- Invalid time formats
- Double-booking attempts
- Timezone edge cases
- Booking conflicts

## 📝 API Documentation

### Endpoint

```
GET https://raw.githubusercontent.com/suyogshiftcare/jsontest/main/available.json
```

### Response Format

```json
[
  {
    "name": "Doctor Name",
    "timezone": "Australia/Sydney",
    "day_of_week": "Monday",
    "available_at": " 9:00AM",
    "available_until": " 5:30PM"
  }
]
```

## 🤝 Contributing

This is a technical challenge submission. For questions or feedback, please contact the developer.

## 📄 License

This project is created for the ShiftCare Technical Challenge.

## 👨‍💻 Developer Notes

### Time Spent

- **Planning & Architecture**: 1 hour
- **Setup & Configuration**: 1 hour
- **Core Features Implementation**: 8 hours
- **UI/UX Polish**: 2 hours
- **Testing**: 2 hours
- **Documentation**: 1 hour
- **Total**: ~15 hours

### Challenges Faced

1. **Timezone Handling**: Ensuring consistent timezone display across the app
2. **Time Slot Generation**: Creating an efficient algorithm for 30-minute slots
3. **State Synchronization**: Keeping bookings in sync between Redux and AsyncStorage
4. **Navigation Types**: Properly typing React Navigation with TypeScript

### What I Would Do Differently

Given more time, I would:
- Implement comprehensive E2E tests with Detox
- Add proper error boundaries and crash reporting
- Implement a more sophisticated caching strategy
- Add animations and transitions for better UX
- Create a design system with reusable styled components
- Add performance monitoring and analytics

---

**Built with ❤️ for ShiftCare Technical Challenge**
