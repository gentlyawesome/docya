import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from './Button';
import { COLORS, FONTS } from '../constants';

const CARDS = [
  {
    icon: '👋',
    title: 'Welcome to Docya',
    body: 'Your appointment book. You book your patients; they do not need the app or an account.',
  },
  {
    icon: '🗓️',
    title: 'Set your working hours',
    body: 'We started you with Monday to Friday, 9 to 5. Change the days and hours any time in the Schedule tab.',
  },
  {
    icon: '✅',
    title: 'Book your first patient',
    body: 'Tap New appointment, type the patient’s name, pick a time slot. We will remind you before each visit.',
  },
];

interface Props {
  visible: boolean;
  onFinish: () => void;
}

// First-launch introduction, shown once per account
export const WelcomeCards: React.FC<Props> = ({ visible, onFinish }) => {
  const [index, setIndex] = useState(0);
  const card = CARDS[index];
  const last = index === CARDS.length - 1;

  const finish = () => {
    setIndex(0);
    onFinish();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={finish}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.icon} accessibilityElementsHidden>
            {card.icon}
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            {card.title}
          </Text>
          <Text style={styles.body}>{card.body}</Text>
          <View style={styles.dots} accessibilityElementsHidden>
            {CARDS.map((c, i) => (
              <View
                key={c.title}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
          <Button
            title={last ? 'Get started' : 'Next'}
            onPress={last ? finish : () => setIndex(index + 1)}
          />
          {!last ? (
            <TouchableOpacity
              style={styles.skip}
              onPress={finish}
              accessibilityRole="button"
              accessibilityLabel="Skip"
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'stretch',
  },
  icon: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 24,
    fontFamily: FONTS.serif,
    fontWeight: '400',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: COLORS.primary },
  skip: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  skipText: { fontSize: 16, color: COLORS.textSecondary },
});
