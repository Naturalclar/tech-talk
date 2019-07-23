const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-typescript', '@babel/preset-react'],
            },
          },
        ],
        exclude: /node_modules/,
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  plugins: [
    new MonacoWebpackPlugin({
      // syntax highlighter
      // available options are documented at https://github.com/Microsoft/monaco-editor-webpack-plugin#options
      languages: ['javascript', 'typescript', 'typescriptreact'],
    }),
  ],
  resolve: { extensions: ['.js', '.ts', '.tsx'] },
}
