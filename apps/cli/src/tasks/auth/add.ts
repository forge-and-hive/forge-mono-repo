// TASK: add
// Run this task with:
// forge task:run auth:add

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

import { load as loadProfiles } from './load'
import { type Profiles } from '../types'

const schema = new Schema({
  name: Schema.string(),
  apiKey: Schema.string(),
  apiSecret: Schema.string(),
  url: Schema.string()
})

const boundaries = {
  loadProfiles: loadProfiles.asBoundary(),
  persistProfiles: async (profiles: Profiles): Promise<void> => {
    const buildsPath = path.join(os.homedir(), '.forge')
    const profilesPath = path.join(buildsPath, 'profiles.json')
    await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2))
  },
  fetchMeInfo: async (apiKey: string, apiSecret: string, url: string): Promise<{
    success: boolean
    teamName?: string
    teamUuid?: string
    userName?: string
    error?: string
  }> => {
    try {
      const response = await fetch(`${url}/api/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}:${apiSecret}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          teamName: data.team?.name,
          teamUuid: data.team?.uuid,
          userName: data.user?.name
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { success: false, error: errorData.error || `HTTP ${response.status}` }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }
}

export const add = createTask({
  schema,
  boundaries,
  fn: async function ({ name, apiKey, apiSecret, url }, { loadProfiles, persistProfiles, fetchMeInfo }) {
    const profiles = await loadProfiles({})

    console.log('Verifying credentials...')

    // Fetch team and user information from /me endpoint
    const meInfo = await fetchMeInfo(apiKey, apiSecret, url)

    if (!meInfo.success) {
      throw new Error(`Failed to verify credentials: ${meInfo.error}`)
    }

    console.log('✅ Credentials verified')
    if (meInfo.userName) {
      console.log(`   User: ${meInfo.userName}`)
    }
    if (meInfo.teamName) {
      console.log(`   Team: ${meInfo.teamName}`)
    }

    // Create profile with team information
    const profile = {
      name,
      apiKey,
      apiSecret,
      url,
      teamName: meInfo.teamName,
      teamUuid: meInfo.teamUuid,
      userName: meInfo.userName
    }

    // Check if profile with same name already exists
    const existingProfileIndex = profiles.profiles.findIndex(p => p.name === name)
    if (existingProfileIndex >= 0) {
      // Replace existing profile
      profiles.profiles[existingProfileIndex] = profile
    } else {
      // Add new profile
      profiles.profiles.push(profile)
    }

    // Set as default profile
    profiles.default = name

    // Persist profiles
    await persistProfiles(profiles)

    return {
      status: 'Ok',
      message: `Profile '${name}' added and set as default`,
      teamName: meInfo.teamName,
      userName: meInfo.userName
    }
  }
})
