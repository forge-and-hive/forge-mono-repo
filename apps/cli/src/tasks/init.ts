import path from 'path'
import fs from 'fs/promises'

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

import { type ForgeConf } from './types'

const schema = new Schema({
  dryRun: Schema.boolean().optional()
})

const boundaries = {
  saveFile: async (path: string, content: string): Promise<void> => {
    await fs.writeFile(path, content)
  },
  getCwd: async (): Promise<string> => {
    return process.cwd()
  }
}

// Create a task with type inference from schema and boundaries
export const init = createTask({
  schema,
  boundaries,
  fn: async function (argv, { saveFile, getCwd }) {
    // Handle the dryRun flag
    const isDryRun = Boolean(argv.dryRun)

    const cwd = await getCwd()
    const forgePath = path.join(cwd, 'forge.json')

    const config: ForgeConf = {
      project: {
        name: 'BaseProject'
      },
      paths: {
        logs: 'logs/',
        fixtures: 'fixtures/',
        fingerprints: 'fingerprints/',
        tasks: 'src/tasks/',
        runners: 'src/runners/',
        tests: 'src/tests/'
      },
      infra: {
        region: 'us-west-2',
        bucket: ''
      },
      tasks: {},
      runners: {}
    }

    const content = JSON.stringify(config, null, 2)

    if (!isDryRun) {
      await saveFile(forgePath, content)
    } else {
      console.log('Dry run, not creating forge.json')
      console.log(content)
    }

    return config
  }
})
