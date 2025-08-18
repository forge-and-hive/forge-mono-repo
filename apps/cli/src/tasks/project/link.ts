// TASK: link
// Run this task with:
// forge project:link [uuid]

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import fs from 'fs/promises'
import path from 'path'

import { load as loadConf } from '../conf/load'
import { loadCurrent as loadCurrentProfile } from '../auth/loadCurrent'
import { type ForgeConf, type Profile } from '../types'

const name = 'project:link'
const description = 'Link an existing remote project to the local project by UUID'

const schema = new Schema({
  uuid: Schema.string()
})

const boundaries = {
  loadConf: loadConf.asBoundary(),
  loadCurrentProfile: loadCurrentProfile.asBoundary(),
  writeFile: async (filePath: string, content: string): Promise<void> => {
    await fs.writeFile(filePath, content, 'utf-8')
  },
  fetchProject: async (profile: Profile, uuid: string): Promise<Response> => {
    const authToken = `${profile.apiKey}:${profile.apiSecret}`
    console.log(`Fetching project ${uuid} from ${profile.url}...`)
    return await fetch(`${profile.url}/api/projects/${uuid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })
  }
}

export const link = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function ({ uuid }, { loadConf, loadCurrentProfile, writeFile, fetchProject }) {
    // Load current configuration and profile
    const conf = await loadConf({})

    // Check if project already has a UUID
    if (conf.project.uuid) {
      throw new Error(`Project is already linked to UUID: ${conf.project.uuid}. Use a different project or remove the existing UUID from forge.json first.`)
    }

    const profile = await loadCurrentProfile({})

    console.log(`Checking if project ${uuid} exists on ${profile.url}...`)

    // Check if project exists on remote
    const response = await fetchProject(profile, uuid)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Project with UUID ${uuid} not found on ${profile.url}. Please verify the UUID is correct.`)
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please check your profile credentials with \'forge auth:list\'.')
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to verify project: ${response.status} ${response.statusText} - ${errorText}`)
      }
    }

    const projectData = await response.json()
    const project = projectData.project

    console.log(`✓ Found project: ${project.projectName}`)
    console.log(`  Description: ${project.description || 'No description'}`)
    console.log(`  Tasks: ${project.tasks.length} task(s)`)

    // Update forge.json with the UUID
    const forgePath = path.join(process.cwd(), 'forge.json')
    const updatedConf: ForgeConf = {
      ...conf,
      project: {
        ...conf.project,
        uuid: uuid
      }
    }

    await writeFile(forgePath, JSON.stringify(updatedConf, null, 2))

    console.log(`\n✓ Successfully linked project ${uuid} to local forge.json`)
    console.log(`  Local project name: ${conf.project.name}`)
    console.log(`  Remote project name: ${project.projectName}`)
    console.log(`\n🌐 View your project on the dashboard: ${profile.url}/dashboard/projects/${uuid}`)

    return {
      success: true,
      linkedProject: {
        uuid: project.uuid,
        name: project.projectName,
        description: project.description,
        tasksCount: project.tasks.length
      }
    }
  }
})

