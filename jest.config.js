module.exports = {
  preset: 'jest-expo',
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // react-redux's "react-native" export condition points at an ESM bundle that
    // Jest cannot require. Its CommonJS build is the same library.
    '^react-redux$': '<rootDir>/node_modules/react-redux/dist/cjs/index.js',
  },
  // Reanimated and other native modules are stubbed so component specs can render.
  setupFiles: ['<rootDir>/jest.setup.js'],
};
