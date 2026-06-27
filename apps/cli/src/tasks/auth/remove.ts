// TASK: remove
// Run this task with:
// forge task:run auth:remove --profileName [name]

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

import { load as loadProfiles } from './load'
import { type Profiles } from '../types'

const schema = new Schema({
  profileName: Schema.string().describe('The name of the auth profile to remove')
})

const boundaries = {
  loadProfiles: loadProfiles.asBoundary(),
  persistProfiles: async (profiles: Profiles): Promise<void> => {
    const buildsPath = path.join(os.homedir(), '.forge')
    const profilesPath = path.join(buildsPath, 'profiles.json')
    await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2))
  }
}

export const remove = createTask({
  schema,
  boundaries,
  fn: async function ({ profileName }, { loadProfiles, persistProfiles }) {
    const profiles = await loadProfiles({})

    // Check if profile exists
    const profileExists = profiles.profiles.some(profile => profile.name === profileName)

    if (!profileExists) {
      throw new Error(`Profile "${profileName}" not found. Use auth:list to see available profiles.`)
    }

    // Remove the profile using filter
    profiles.profiles = profiles.profiles.filter(profile => profile.name !== profileName)

    // If the removed profile was the default, update the default
    if (profiles.default === profileName) {
      if (profiles.profiles.length > 0) {
        // Set the first available profile as default
        profiles.default = profiles.profiles[0].name
        console.log(`Default profile set to: ${profiles.default}`)
      } else {
        // No profiles left, set default to empty
        profiles.default = ''
        console.log('No profiles left. Default set to empty.')
      }
    }

    // Persist updated profiles
    await persistProfiles(profiles)

    console.log(`Profile "${profileName}" has been removed.`)

    return {
      status: 'Ok',
      message: `Profile "${profileName}" has been removed.`
    }
  }
})
