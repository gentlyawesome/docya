import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

// The tab bar floats 12pt above the bottom edge, so scrolling content must clear its height plus that gap.
// 0 outside a tab navigator.
const FLOAT_GAP = 12;

export const useTabBarInset = (): number => {
  const height = useContext(BottomTabBarHeightContext) ?? 0;
  return height > 0 ? height + FLOAT_GAP : 0;
};
