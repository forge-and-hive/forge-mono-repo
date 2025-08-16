// TASK: list
// Run this task with:
// forge task:run auth:list

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

import { load as loadProfiles } from './load'
import { type Profiles } from '../types'

const schema = new Schema({})

const boundaries = {
  loadProfiles: loadProfiles.asBoundary()
}

export const list = createTask({
  schema,
  boundaries,
  fn: async function (_argv, { loadProfiles }) {
    const profiles: Profiles = await loadProfiles({})

    if (profiles.profiles.length === 0) {
      console.log('No profiles found. Use auth:add to create one.')
      return { status: 'Ok', profiles: [] }
    }

    // Show current profile
    const currentProfile = profiles.profiles.find(profile => profile.name === profiles.default)
    if (currentProfile) {
      console.log('Current Profile:')
      console.log(`  Name: ${currentProfile.name}`)
      console.log(`  API Key: ${currentProfile.apiKey}`)
      console.log(`  URL: ${currentProfile.url}`)
      console.log('')
    }

    console.log('Available profiles:\n')

    const tableData = profiles.profiles.map(profile => ({
      Name: profile.name,
      'API Key': profile.apiKey,
      URL: profile.url
    }))

    console.table(tableData, ['Name', 'API Key', 'URL'])

    console.log('\nUse auth:add to create or update a profile')
    console.log('Use auth:switch [name] or auth:switch [index] to switch profiles')
    console.log('========================================')

    return {
      default: profiles.default,
      profiles: tableData
    }
  }
})
