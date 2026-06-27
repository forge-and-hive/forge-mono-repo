// TASK: create
// Run this task with:
// forge task:run runner:create --runnerName <runner-name>
// forge task:run runner:create --runnerName inventory

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

import Handlebars from 'handlebars'
import path from 'path'
import fs from 'fs/promises'
import { camelCase } from '../../utils/camelCase'

import { load } from '../conf/load'
import { type RunnerDescriptor, type ForgeConf } from '../types'

// Define the template content directly in the code
const RUNNER_TEMPLATE = `// RUNNER: {{ runnerName }}
import { Runner } from '@forgehive/runner'

// Import your tasks here
// import { EXAMPLE_TASK } from '../../tasks/MODULE/TASK'

const {{ runnerName }}Runner = new Runner()

// Load your tasks here
// runner.load('MODULE:TASK', EXAMPLE_TASK)

export { {{ runnerName }}Runner }
`

const schema = new Schema({
  runnerName: Schema.string().describe('The name of the runner to create')
})

const boundaries = {
  // Load boundaries
  loadConf: load.asBoundary(),
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },

  // Persist boundaries
  persistRunner: async (runnerPath: string, runnerName: string, content: string): Promise<{ path: string }> => {
    const folderPath = path.join(runnerPath, runnerName)
    const filePath = path.join(folderPath, 'index.ts')

    let err
    try {
      await fs.stat(folderPath)
    } catch (e) {
      err = e
    }

    if (err === undefined) {
      throw new Error(`Runner folder '${folderPath}' already exists.`)
    }

    await fs.mkdir(folderPath, { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')

    return {
      path: filePath.toString()
    }
  },
  persistConf: async (forge: ForgeConf, cwd: string): Promise<void> => {
    const forgePath = path.join(cwd, 'forge.json')
    await fs.writeFile(forgePath, JSON.stringify(forge, null, 2))
  }
}

export const create = createTask({
  schema,
  boundaries,
  fn: async function ({ runnerName }, {
    persistRunner,
    loadConf,
    persistConf,
    getCwd
  }) {
    const formattedName = camelCase(runnerName)
    const cwd = await getCwd()

    const forge = await loadConf({})
    const runnerPath = forge.paths.runners

    console.log(`
    ==================================================
    Starting runner creation!
    Creating runner: ${formattedName}
    Into: ${runnerPath}${formattedName}/index.ts
    ==================================================
    `)

    const comp = Handlebars.compile(RUNNER_TEMPLATE)
    const content = comp({
      runnerName: formattedName
    })

    await persistRunner(runnerPath, formattedName, content)

    if (forge.runners === undefined) {
      forge.runners = {}
    }

    // Create runner descriptor
    const runnerDescriptor: RunnerDescriptor = {
      path: `${runnerPath}${formattedName}/index.ts`,
      version: '0.0.1'
    }

    forge.runners[formattedName] = runnerDescriptor

    await persistConf(forge, cwd)

    return {
      runnerPath: `${runnerPath}/${formattedName}`,
      runnerName: formattedName
    }
  }
})
