// TASK: remove
// Run this task with:
// forge task:run task:remove

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

import path from 'path'
import fs from 'fs/promises'
import { load } from '../conf/load'
import { type ForgeConf } from '../types'

const schema = new Schema({
  descriptorName: Schema.string().describe('The task descriptor name to remove (e.g. domain:taskName)')
})

const boundaries = {
  loadConf: load.asBoundary(),
  persistConf: async (forge: ForgeConf): Promise<void> => {
    const forgePath = path.join(process.cwd(), 'forge.json')
    await fs.writeFile(forgePath, JSON.stringify(forge, null, 2))
  },
  deleteFile: async (filePath: string): Promise<void> => {
    await fs.unlink(filePath)
  }
}

export const remove = createTask({
  schema,
  boundaries,
  fn: async function ({ descriptorName }, { loadConf, persistConf, deleteFile }) {
    // Load shadow configuration
    const forge: ForgeConf = await loadConf({})

    // Check if the task exists in shadow.json
    if (!forge.tasks[descriptorName]) {
      throw new Error(`Task '${descriptorName}' not found in forge.json`)
    }

    // Get the task file path
    const taskFilePath = path.join(process.cwd(), forge.tasks[descriptorName].path)

    console.log(`
    ==================================================
    Removing task: ${descriptorName}
    File path: ${taskFilePath}
    ==================================================
    `)

    // Delete the task file
    await deleteFile(taskFilePath)

    // Remove the task from shadow.json
    delete forge.tasks[descriptorName]

    // Save the updated shadow.json
    await persistConf(forge)

    return {
      status: 'Ok',
      message: `Task '${descriptorName}' has been successfully removed`
    }
  }
})
