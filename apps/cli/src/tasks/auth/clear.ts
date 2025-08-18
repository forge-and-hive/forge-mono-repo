// TASK: clear
// Run this task with:
// forge task:run auth:clear

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

import { load as loadProfiles } from './load'
import { type Profiles } from '../types'

const schema = new Schema({})

const boundaries = {
  loadProfiles: loadProfiles.asBoundary(),
  clearProfiles: async (): Promise<void> => {
    const buildsPath = path.join(os.homedir(), '.forge')
    const profilesPath = path.join(buildsPath, 'profiles.json')

    // Create empty profiles structure
    const emptyProfiles: Profiles = {
      default: '',
      profiles: []
    }

    await fs.writeFile(profilesPath, JSON.stringify(emptyProfiles, null, 2))
  }
}

export const clear = createTask({
  schema,
  boundaries,
  fn: async function (_argv, { loadProfiles, clearProfiles }) {
    const profiles = await loadProfiles({})

    if (profiles.profiles.length === 0) {
      console.log('No profiles found to clear.')
      return { status: 'Ok', message: 'No profiles found' }
    }

    const profileCount = profiles.profiles.length
    console.log(`Found ${profileCount} profile(s) to clear:`)

    profiles.profiles.forEach(profile => {
      console.log(`  - ${profile.name} (${profile.teamName || 'Unknown team'})`)
    })

    console.log('\\nClearing all profiles...')

    // Clear all profiles
    await clearProfiles()

    console.log('✅ All profiles cleared successfully')

    return {
      status: 'Ok',
      message: `Cleared ${profileCount} profile(s)`,
      clearedCount: profileCount
    }
  }
})
