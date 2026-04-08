// Reanimated v4 sits on top of react-native-worklets, which tries to
// touch a native module on import. Mock the worklets package first so
// the reanimated mock entry point can finish loading.
jest.mock("react-native-worklets", () =>
  require("react-native-worklets/lib/module/mock")
);

// Reanimated v4 ships its own jest mock that stubs the native worklet
// runtime so SharedValues become plain objects and `withTiming` runs
// synchronously.
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock")
);

// react-native-gesture-handler also needs a jest stub — its native
// module isn't available under jest-expo's jsdom environment.
jest.mock("react-native-gesture-handler", () => {
  const View = require("react-native").View;
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: {
      Pan: () => ({
        enabled: () => ({
          onBegin: () => ({
            onUpdate: () => ({ onEnd: () => ({ onFinalize: () => ({}) }) }),
          }),
        }),
      }),
    },
    State: {},
    PanGestureHandler: View,
    TapGestureHandler: View,
  };
});

// Mocks for the native modules used by use-board-sounds. Both modules
// only run in a real RN runtime, so under jest-expo we replace them
// with no-op stubs and capture which methods got called for assertions.

jest.mock("expo-audio", () => {
  const mockPlayer = {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    remove: jest.fn(),
  };
  return {
    __esModule: true,
    useAudioPlayer: jest.fn(() => mockPlayer),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    __mockPlayer: mockPlayer,
  };
});

jest.mock("expo-haptics", () => ({
  __esModule: true,
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));
