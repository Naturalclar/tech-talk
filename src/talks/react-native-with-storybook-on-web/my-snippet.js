module.exports = (config, configType) => {
  config.resolve = {
    modules: ['node_modules'],
    extensions: ['.web.js', '.js', '.json', '.web.jsx', '.jsx'],
    alias: {
      'react-native$': require.resolve('react-native-web'),
    },
  }
}