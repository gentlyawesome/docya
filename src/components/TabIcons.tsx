import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({
  color,
  size = 24,
  children,
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  >
    {children}
  </Svg>
);

export const HomeIcon: React.FC<IconProps> = props => (
  <Icon {...props}>
    <Path d="M3 10.5 12 3l9 7.5" />
    <Path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </Icon>
);

export const CalendarIcon: React.FC<IconProps> = props => (
  <Icon {...props}>
    <Rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <Path d="M3.5 10h17M8 3v4M16 3v4" />
    <Path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
  </Icon>
);

export const ClockIcon: React.FC<IconProps> = props => (
  <Icon {...props}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3.5 2" />
  </Icon>
);

export const UserIcon: React.FC<IconProps> = props => (
  <Icon {...props}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4.5 20.5c.8-3.6 3.7-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
  </Icon>
);
