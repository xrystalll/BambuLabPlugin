import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import path from "node:path";
import url from "node:url";
import json from '@rollup/plugin-json';
import { glob } from 'glob'
import fs from 'node:fs';
const isWatching = !!process.env.ROLLUP_WATCH;
const flexPlugin = "com.xrystalll.bambu.plugin";

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
	input: "src/plugin.js",
	output: {
		file: `${flexPlugin}/backend/plugin.cjs`,
		format: "cjs",
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
			return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
		},
	},
	plugins: [
		json(),
		{
			name: "watch-externals",
			buildStart: function () {
				this.addWatchFile(`${flexPlugin}/manifest.json`);
				const vueFiles = glob.sync(`${flexPlugin}/ui/*.vue`);
        vueFiles.forEach((file) => {
            this.addWatchFile(file);
        });
			},
		},
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true
		}),
		commonjs(),
		!isWatching && terser(),
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
			}
		},
		{
			name: "copy-package-json",
			writeBundle: async () => {
				try {
					// Create package.json file with dependencies
					const packageJson = {
						"name": "backend",
						"version": "1.0.0",
						"private": true,
						"dependencies": {
							"canvas": "*"
						}
					};

					// Ensure target directory exists
					const packageJsonPath = path.join(flexPlugin, 'backend', 'package.json');
					fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

					console.log('Successfully generated package.json, please run npm install in the plugin directory');
				} catch (err) {
					console.error('Error generating package.json:', err);
				}
			}
		}
	],
	external: [
		// Exclude all native modules and node built-in modules
		'canvas',
		'fs', 'path',
		/^node:/
	]
};

export default config;
