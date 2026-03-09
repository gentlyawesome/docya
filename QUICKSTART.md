# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Install iOS Pods (macOS only)
```bash
cd ios && pod install && cd ..
```

### 3. Run the App

**iOS:**
```bash
npx react-native run-ios
```

**Android:**
```bash
npx react-native run-android
```

## 📱 What You'll See

1. **Doctors List** - Browse 6 available doctors
2. **Search** - Filter doctors by name or location
3. **Doctor Schedule** - View availability for next 14 days
4. **Book Appointment** - Select a 30-minute time slot
5. **My Bookings** - View and manage your appointments

## 🧪 Run Tests

```bash
npm test -- --no-watchman
```

## 🐛 Troubleshooting

### Metro Bundler Issues
```bash
npx react-native start --reset-cache
```

### iOS Build Issues
```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

### Android Build Issues
```bash
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### Clear All Caches
```bash
watchman watch-del-all
rm -rf node_modules
npm install
cd ios && pod install && cd ..
```

## 📚 Key Features to Try

1. **Search Doctors**: Type "Christy" or "Sydney" in the search bar
2. **View Schedule**: Tap on any doctor to see their weekly availability
3. **Book Slot**: Select a date, then tap an available time slot
4. **Confirm Booking**: Review details and confirm
5. **View Bookings**: Switch to "My Bookings" tab
6. **Cancel Booking**: Tap "Cancel Appointment" on any booking

## 🎯 Test Data

The app uses live data from:
```
https://raw.githubusercontent.com/suyogshiftcare/jsontest/main/available.json
```

**Available Doctors:**
- Christy Schumm (Sydney)
- Natalia Stanton Jr. (Perth)
- Nola Murazik V (Darwin)
- Elyssa O'Kon (Perth)
- Dr. Geovany Keebler (Perth)
- Ramy Malik (Perth)

## 💡 Tips

- Pull down to refresh doctor list
- Booked slots are grayed out
- All times shown in doctor's timezone
- Bookings persist locally (AsyncStorage)
- No authentication required

---

**Need help?** Check the full [README.md](./README.md) for detailed documentation.
