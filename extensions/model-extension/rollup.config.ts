import resolve from '@rollup/plugin-node-resolve'
import sourceMaps from 'rollup-plugin-sourcemaps'
import typescript from 'rollup-plugin-typescript2'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'

const packageJson = require('./package.json')

export default [
  {
    input: `src/index.ts`,
    output: [{ file: packageJson.main, format: 'es', sourcemap: true }],
    // Indicate here external modules you don't wanna include in your bundle (i.e.: 'lodash')
    external: [],
    watch: {
      include: 'src/**',
    },
    plugins: [
      replace({
        EXTENSION_NAME: JSON.stringify(packageJson.name),
        MODULE_PATH: JSON.stringify(
          `${packageJson.name}/${packageJson.module}`
        ),
        VERSION: JSON.stringify(packageJson.version),
      }),
      // Allow json resolution
      json(),
      //     Compile TypeScript files
      typescript({ useTsconfigDeclarationDir: true }),
      // Compile TypeScript files
      // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
      // commonjs(),
      // Allow node_modules resolution, so you can use 'external' to control
      // which external modules to include in the bundle
      // https://github.com/rollup/rollup-plugin-node-resolve#usage
      resolve({
        extensions: ['.js', '.ts', '.svelte'],
        browser: true,
      }),

      // Resolve source maps to the original source
      sourceMaps(),
    ],
  },
]
