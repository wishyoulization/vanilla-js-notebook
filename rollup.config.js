import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import styles from 'rollup-plugin-styles';
import { terser } from 'rollup-plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/iridium.js',
    format: 'esm',
    name: 'IridiumApp',
  },
  plugins: [
    nodeResolve({
      browser: true,
    }),
    commonjs(),
    styles(),
    terser(),
    visualizer(),
  ],
};
