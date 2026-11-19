import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { SensorType, useAnimatedSensor, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

/**
 * Leans its content with the phone (apple-design: the ticket follows the
 * hand instead of floating on a loop). With "Reducir movimiento", still.
 */
export function Tilt({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const rotation = useAnimatedSensor(SensorType.ROTATION, { interval: 32 });
  const animated = useAnimatedStyle(() => {
    if (reducedMotion) return {};
    const { pitch, roll } = rotation.sensor.value;
    const clamp = (value: number) => Math.max(-0.5, Math.min(0.5, value));
    return {
      transform: [
        { perspective: 800 },
        { rotateX: `${clamp(pitch - 0.6) * -14}deg` },
        { rotateY: `${clamp(roll) * 18}deg` },
      ],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
