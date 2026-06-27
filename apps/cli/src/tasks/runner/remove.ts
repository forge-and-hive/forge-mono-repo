// TASK: remove
// Run this task with:
// forge task:run runner:remove --runnerName <runner-name>

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import path from 'path'
import fs from 'fs/promises'
import { camelCase } from '../../utils/camelCase'
import { load } from '../conf/load'
import { type ForgeConf } from '../types'

const schema = new Schema({
  runnerName: Schema.string().describe('The name of the runner to remove')
})

const boundaries = {
  // Load boundaries
  loadConf: load.asBoundary(),
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },

  // File system operations
  removeRunner: async (runnerPath: string): Promise<void> => {
    await fs.rm(runnerPath, { recursive: true, force: true })
  },
  // Configuration operations
  persistConf: async (forge: ForgeConf, cwd: string): Promise<void> => {
    const forgePath = path.join(cwd, 'forge.json')
    await fs.writeFile(forgePath, JSON.stringify(forge, null, 2))
  }
}

export const remove = createTask({
  schema,
  boundaries,
  fn: async function ({ runnerName }, {
    loadConf,
    getCwd,
    removeRunner,
    persistConf
  }) {
    const formattedName = camelCase(runnerName)
    const cwd = await getCwd()
    const forge = await loadConf({})

    if (!forge.runners || !forge.runners[formattedName]) {
      throw new Error(`Runner '${formattedName}' not found in forge.json configuration`)
    }

    const runnerConfig = forge.runners[formattedName]
    const runnerFolder = path.join(cwd, path.dirname(runnerConfig.path))

    console.log(`
    ==================================================
    Removing runner: ${formattedName}
    Path: ${runnerFolder}
    ==================================================
    `)

    await removeRunner(runnerFolder)

    delete forge.runners[formattedName]

    await persistConf(forge, cwd)

    return {
      status: 'success',
      message: `Runner '${formattedName}' successfully removed`,
      runnerName: formattedName
    }
  }
})
