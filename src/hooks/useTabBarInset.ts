import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

// Height of the bottom tab bar (0 outside a tab navigator), so scrolling content can clear it
export const useTabBarInset = (): number => useContext(BottomTabBarHeightContext) ?? 0;
