// TASK: bundle
// Run this task with:
// forge task:run runner:bundle --runnerName=<runner-name> --targetPath=<target-path>

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import esbuild from 'esbuild'
import path from 'path'
import fs from 'fs/promises'
import { load as loadConf } from '../conf/load'
import { type ForgeConf } from '../types'

const schema = new Schema({
  runnerName: Schema.string(),
  targetPath: Schema.string()
})

const boundaries = {
  loadConf: loadConf.asBoundary(),
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },
  ensureDir: async (dirPath: string): Promise<void> => {
    try {
      await fs.access(dirPath)
    } catch (error) {
      throw new Error(`Directory ${dirPath} does not exist`)
    }
  }
}

export const bundle = createTask({
  schema,
  boundaries,
  fn: async function ({ runnerName, targetPath }, { loadConf, getCwd, ensureDir }) {
    // Load forge configuration
    const forge: ForgeConf = await loadConf({})
    const cwd = await getCwd()

    // Verify runner exists in forge.json
    if (!forge.runners || !forge.runners[runnerName]) {
      throw new Error(`Runner '${runnerName}' not found in forge.json configuration`)
    }

    // Get runner entry point from forge.json
    const runnerConfig = forge.runners[runnerName]
    const entryPoint = path.join(cwd, runnerConfig.path)
    const outputFile = path.join(targetPath, `${runnerName}.js`)

    console.log(`
      ==================================================
      Starting runner creation!
      Creating runner: ${runnerName}
      Entrypoint: ${entryPoint}
      Output file: ${outputFile}
      ==================================================
    `)

    // Ensure target directory exists
    await ensureDir(path.dirname(targetPath))

    // Get external packages from config, default to empty array
    const externalPackages = forge.build?.externalPackages ?? []

    // Build using esbuild
    await esbuild.build({
      entryPoints: [entryPoint],
      outfile: outputFile,
      bundle: true,
      minify: true,
      platform: 'node',
      sourcemap: true,
      external: externalPackages
    })

    return {
      status: 'Success',
      runnerName,
      entryPoint,
      outputFile: path.join(targetPath, `${runnerName}.js`)
    }
  }
})
