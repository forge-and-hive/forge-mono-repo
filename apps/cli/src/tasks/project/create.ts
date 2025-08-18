// TASK: create
// Run this task with:
// forge task:run project:create

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'

import { load as loadConf } from '../conf/load'
import { loadCurrent as loadCurrentProfile } from '../auth/loadCurrent'
import { type ForgeConf, type Profile } from '../types'

const name = 'project:create'
const description = 'Create a new project in ForgeHive'

const schema = new Schema({
  projectName: Schema.string().optional(),
  description: Schema.string().optional()
})

const boundaries = {
  loadConf: loadConf.asBoundary(),
  loadCurrentProfile: loadCurrentProfile.asBoundary(),
  writeFile: async (filePath: string, content: string): Promise<void> => {
    await fs.writeFile(filePath, content, 'utf-8')
  },
  createProject: async (profile: Profile, payload: { projectName: string; description: string; uuid: string }): Promise<Response> => {
    const authToken = `${profile.apiKey}:${profile.apiSecret}`
    return await fetch(`${profile.url}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    })
  }
}

export const create = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function (argv, { loadConf, loadCurrentProfile, writeFile, createProject }) {
    const { projectName: inputProjectName, description } = argv

    // Load current configuration
    const conf = await loadConf({})

    // Use provided projectName or fall back to forge.json project name
    const projectName = inputProjectName || conf.project.name

    if (!projectName) {
      throw new Error('Project name is required. Provide --projectName or ensure forge.json has a project name.')
    }

    // Check if project already has a UUID, generate one if not
    let projectUuid = conf.project.uuid
    if (!projectUuid) {
      projectUuid = uuidv4()

      // Update forge.json with the new UUID
      const forgePath = path.join(process.cwd(), 'forge.json')
      const updatedConf: ForgeConf = {
        ...conf,
        project: {
          ...conf.project,
          uuid: projectUuid
        }
      }

      await writeFile(forgePath, JSON.stringify(updatedConf, null, 2))
      console.log(`Generated and saved project UUID: ${projectUuid}`)
    }

    // Load current profile for API authentication
    const profile = await loadCurrentProfile({})

    // Prepare API request payload
    const payload = {
      projectName,
      description: description || '',
      uuid: projectUuid
    }

    // Make API request to create project
    const response = await createProject(profile, payload)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create project: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()

    console.log('Project created successfully!')
    console.log(`Project UUID: ${result.project.uuid}`)
    console.log(`Project Name: ${result.project.projectName}`)
    console.log(`\n🌐 View your project on the dashboard: ${profile.url}/dashboard/projects/${result.project.uuid}`)

    return {
      success: true,
      project: result.project,
      localUuid: projectUuid
    }
  }
})

