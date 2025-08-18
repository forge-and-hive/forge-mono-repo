// TASK: switch
// Run this task with:
// forge auth:switch [name] or forge auth:switch [index]

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

import { load as loadProfiles } from './load'
import { type Profiles } from '../types'

const schema = new Schema({
  profileName: Schema.string()
})

const boundaries = {
  loadProfiles: loadProfiles.asBoundary(),
  persistProfiles: async (profiles: Profiles): Promise<void> => {
    const buildsPath = path.join(os.homedir(), '.forge')
    const profilesPath = path.join(buildsPath, 'profiles.json')
    await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2))
  }
}

export const switchProfile = createTask({
  schema,
  boundaries,
  fn: async function ({ profileName }, { loadProfiles, persistProfiles }) {
    // Load profiles
    const profiles = await loadProfiles({})

    if (profiles.profiles.length === 0) {
      throw new Error('No profiles found. Use auth:add to create one.')
    }

    let targetProfile: string

    // Check if profileName is a number (index)
    const indexInput = parseInt(profileName, 10)
    if (!isNaN(indexInput)) {
      // Using index
      if (indexInput < 0 || indexInput >= profiles.profiles.length) {
        throw new Error(`Profile index ${indexInput} is out of range. Use auth:list to see available profiles (0-${profiles.profiles.length - 1}).`)
      }
      targetProfile = profiles.profiles[indexInput].name
    } else {
      // Using profile name
      const profileExists = profiles.profiles.some(profile => profile.name === profileName)
      if (!profileExists) {
        throw new Error(`Profile "${profileName}" not found. Use auth:list to see available profiles.`)
      }
      targetProfile = profileName
    }

    // Update default profile
    profiles.default = targetProfile

    // Save updated profiles
    await persistProfiles(profiles)

    console.log(`Switched to profile: ${targetProfile}`)

    return {
      default: targetProfile
    }
  }
})
