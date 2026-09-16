/* eslint-disable @typescript-eslint/no-require-imports */

// Reanimated's own Jest mock still loads the worklets runtime, which cannot
// initialise outside the native runtime, so component specs get a minimal
// stand-in: animated views render as plain views and every animation helper
// resolves to its target value synchronously. Logic-only specs never import it.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, ScrollView, FlatList } = require('react-native');

  const passThrough = value => value;
  const makeTransition = () => {
    const transition = {};
    const chain = () => transition;
    ['springify', 'duration', 'delay', 'mass', 'damping', 'stiffness', 'easing'].forEach(key => {
      transition[key] = chain;
    });
    return transition;
  };

  const createAnimatedComponent = Component => {
    const Animated = React.forwardRef((props, ref) => React.createElement(Component, { ...props, ref }));
    Animated.displayName = `Animated(${Component?.displayName || Component?.name || 'Component'})`;
    return Animated;
  };

  const sharedValue = initial => ({ value: initial });

  return {
    __esModule: true,
    default: {
      View: createAnimatedComponent(View),
      Text: createAnimatedComponent(Text),
      ScrollView: createAnimatedComponent(ScrollView),
      FlatList: createAnimatedComponent(FlatList),
      createAnimatedComponent,
    },
    createAnimatedComponent,
    useSharedValue: sharedValue,
    useDerivedValue: factory => ({ value: factory() }),
    useAnimatedStyle: factory => factory(),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => () => {},
    runOnJS: fn => fn,
    runOnUI: fn => fn,
    withTiming: passThrough,
    withSpring: passThrough,
    withDelay: (_delay, value) => value,
    withSequence: (...values) => values[values.length - 1],
    withRepeat: passThrough,
    interpolate: () => 0,
    interpolateColor: () => 'transparent',
    Easing: new Proxy({}, { get: () => () => {} }),
    LinearTransition: makeTransition(),
    FadeIn: makeTransition(),
    FadeOut: makeTransition(),
    SlideInDown: makeTransition(),
    SlideOutDown: makeTransition(),
  };
});

// Native keyboard bindings are unavailable under Jest; components only need the
// hooks to exist and the views to render their children.
jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Pass = ({ children }) => React.createElement(View, null, children);
  return {
    __esModule: true,
    useKeyboardHandler: () => {},
    useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
    KeyboardAvoidingView: Pass,
    KeyboardStickyView: Pass,
    KeyboardProvider: Pass,
    KeyboardController: { dismiss: jest.fn() },
  };
});

// Some components import the worklets runtime directly (e.g. the slider).
jest.mock('react-native-worklets', () => ({
  __esModule: true,
  runOnJS: fn => fn,
  runOnUI: fn => fn,
  createWorkletRuntime: () => ({}),
  scheduleOnRN: fn => fn,
  scheduleOnUI: fn => fn,
}));
