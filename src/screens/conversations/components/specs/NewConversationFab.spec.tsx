import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NewConversationFab } from '../NewConversationFab';

const mockDispatch = jest.fn();

// The FAB measures the tab bar, which reads the safe-area inset.
const METRICS = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

const mount = () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <NewConversationFab />
      </SafeAreaProvider>,
    );
  });
  return tree;
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  StackActions: { push: (name: string) => ({ type: 'PUSH', name }) },
}));

describe('NewConversationFab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the New Chat screen when pressed', () => {
    const tree = mount();

    const fab = tree.root.findAll(
      node =>
        node.props?.testID === 'new-conversation-fab' && typeof node.props?.onPress === 'function',
    )[0];
    act(() => fab.props.onPress());

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'PUSH', name: 'NewChatScreen' });
    act(() => tree.unmount());
  });

  it('carries an accessible label rather than relying on the glyph alone', () => {
    const tree = mount();

    const fab = tree.root.findAll(node => node.props?.testID === 'new-conversation-fab')[0];
    expect(fab.props.accessibilityRole).toBe('button');
    expect(fab.props.accessibilityLabel).toBe('New conversation');
    act(() => tree.unmount());
  });
});
