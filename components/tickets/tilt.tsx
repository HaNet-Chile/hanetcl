import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { SensorType, useAnimatedSensor, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

/**
 * Leans its content with the phone (apple-design: the ticket follows the
 * hand instead of floating on a loop). With "Reducir movimiento", still.
 */
export function Tilt({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  // Only the shared value goes into the worklet, not the sensor object with
  // its functions; and nothing returns an empty style, so the transform
  // always has the same shape.
  const { sensor } = useAnimatedSensor(SensorType.ROTATION, { interval: 32 });
  const animated = useAnimatedStyle(() => {
    const { pitch, roll } = sensor.get();
    const x = reducedMotion || !Number.isFinite(pitch) ? 0 : Math.max(-0.5, Math.min(0.5, pitch - 0.6));
    const y = reducedMotion || !Number.isFinite(roll) ? 0 : Math.max(-0.5, Math.min(0.5, roll));
    return {
      transform: [
        { perspective: 800 },
        { rotateX: `${x * -14}deg` },
        { rotateY: `${y * 18}deg` },
      ],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
