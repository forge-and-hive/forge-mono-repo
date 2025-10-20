// TASK: create
// Run this task with:
// forge task:run bundle:create

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import esbuild from 'esbuild'
import { load as loadConf } from '../conf/load'
import { type ForgeConf } from '../types'

const schema = new Schema({
  entryPoint: Schema.string(),
  outputFile: Schema.string()
})

const boundaries = {
  loadConf: loadConf.asBoundary()
}

export const create = createTask({
  schema,
  boundaries,
  fn: async function ({ entryPoint, outputFile }, { loadConf }) {
    // Load forge configuration
    const forge: ForgeConf = await loadConf({})

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

    return { outputFile }
  }
})
