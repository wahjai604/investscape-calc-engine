const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    filename: 'investscape-calc-engine.umd.js',
    path: path.resolve(__dirname, 'dist/umd'),
    library: 'investScapeCalcEngine',
    libraryTarget: 'umd',
    globalObject: 'typeof self !== "undefined" ? self : this'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.umd.json'
          }
        },
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  performance: {
    maxEntrypointSize: 250000,
    maxAssetSize: 250000
  }
};
