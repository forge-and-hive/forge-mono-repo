// TASK: unlink
// Run this task with:
// forge project:unlink

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import fs from 'fs/promises'
import path from 'path'

import { load as loadConf } from '../conf/load'
import { type ForgeConf } from '../types'

const name = 'project:unlink'
const description = 'Remove the project UUID link from local forge.json'

const schema = new Schema({
  // No parameters needed for unlink
})

const boundaries = {
  loadConf: loadConf.asBoundary(),
  writeFile: async (filePath: string, content: string): Promise<void> => {
    await fs.writeFile(filePath, content, 'utf-8')
  }
}

export const unlink = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function (argv, { loadConf, writeFile }) {
    // Load current configuration
    const conf = await loadConf({})

    // Check if project has a UUID to unlink
    if (!conf.project.uuid) {
      throw new Error('No project UUID found in forge.json. The project is not currently linked to a remote project.')
    }

    const currentUuid = conf.project.uuid

    // Remove the UUID from the project configuration
    const updatedConf: ForgeConf = {
      ...conf,
      project: {
        ...conf.project,
        uuid: undefined
      }
    }

    // Clean up undefined values by creating a new object without the uuid field
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { uuid, ...projectWithoutUuid } = updatedConf.project
    const finalConf: ForgeConf = {
      ...updatedConf,
      project: projectWithoutUuid
    }

    // Write the updated configuration back to forge.json
    const forgePath = path.join(process.cwd(), 'forge.json')
    await writeFile(forgePath, JSON.stringify(finalConf, null, 2))

    console.log(`✓ Successfully unlinked project from UUID: ${currentUuid}`)
    console.log('  The project is no longer linked to a remote project.')
    console.log('  You can now link to a different project using \'forge project:link [uuid]\'')

    return {
      success: true,
      unlinkedUuid: currentUuid
    }
  }
})

