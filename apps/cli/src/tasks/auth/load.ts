// TASK: load
// Run this task with:
// forge task:run auth:load

import os from 'os'
import path from 'path'
import fs from 'fs/promises'

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

import { type Profiles } from '../types'

const schema = new Schema({})

const boundaries = {
  ensureBuildsFolder: async (): Promise<string> => {
    const buildsPath = path.join(os.homedir(), '.forge')
    try {
      await fs.access(buildsPath)
    } catch {
      await fs.mkdir(buildsPath, { recursive: true })
    }

    return buildsPath
  }
}

export const load = createTask({
  schema,
  boundaries,
  fn: async function (argv, { ensureBuildsFolder }) {
    const buildsPath = await ensureBuildsFolder()

    let profiles: Profiles = {
      default: '',
      profiles: []
    }

    const profilesPath = path.join(buildsPath, 'profiles.json')
    try {
      const content = await fs.readFile(profilesPath, 'utf-8')
      profiles = JSON.parse(content) as Profiles
    } catch (_error) {
      console.log('Creating profiles.json')
      console.log('===============================================')
      await fs.writeFile(profilesPath, '{"profiles": [], "default": ""}')
    }

    return profiles
  }
})
