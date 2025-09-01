// TASK: invoke
// Run this task with:
// forge task:run task:invoke

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import { isInvokeError, type InvokeResult } from '@forgehive/hive-sdk'
import axios from 'axios'

import { load as loadConf } from '../conf/load'
import { loadCurrent as loadCurrentProfile } from '../auth/loadCurrent'
import { type ForgeConf, type Profile } from '../types'

const name = 'task:invoke'
const description = 'Invoke a deployed task remotely using the Hive API'

const schema = new Schema({
  descriptorName: Schema.string(),
  json: Schema.string()
})

const boundaries = {
  loadConf: loadConf.asBoundary(),
  loadCurrentProfile: loadCurrentProfile.asBoundary(),
  parseJSON: async (jsonString: string): Promise<unknown> => {
    try {
      return JSON.parse(jsonString)
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },
  invokeTask: async (
    projectUuid: string,
    taskUuid: string,
    profile: Profile,
    taskName: string,
    payload: unknown
  ): Promise<InvokeResult | null> => {
    const invokeUrl = `${profile.url}/api/projects/${projectUuid}/tasks/${taskUuid}/invoke`
    const authToken = `${profile.apiKey}:${profile.apiSecret}`

    console.log(`Invoking task: ${taskName} (${taskUuid})`)
    console.log('Payload:', payload)
    console.log(`Using profile: ${profile.name} (${profile.url})`)

    try {
      const response = await axios.post(invokeUrl, {
        payload
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      return response.data
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string } } }
        if (axiosError.response?.data?.error) {
          return { error: axiosError.response.data.error }
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Network error'
      return { error: errorMessage }
    }
  }
}

export const invoke = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function ({ descriptorName, json }, { loadConf, loadCurrentProfile, parseJSON, invokeTask }) {
    // Load forge configuration
    const forge: ForgeConf = await loadConf({})
    const taskDescriptor = forge.tasks[descriptorName as keyof typeof forge.tasks]

    if (taskDescriptor === undefined) {
      throw new Error(`Task "${descriptorName}" is not defined in forge.json`)
    }

    // Check for required UUIDs
    if (!forge.project.uuid) {
      throw new Error('Project UUID is not defined in forge.json. Please ensure your project has a UUID.')
    }

    if (!taskDescriptor.uuid) {
      throw new Error(`Task "${descriptorName}" does not have a UUID in forge.json. Please ensure your task has a UUID.`)
    }

    // Load profile (required for invoke)
    let profile: Profile
    try {
      profile = await loadCurrentProfile({})
    } catch (error) {
      throw new Error('No profile found. Please authenticate first using: forge auth:add')
    }

    // Parse the JSON payload
    const payload = await parseJSON(json)

    // Invoke the task using the boundary
    const result = await invokeTask(forge.project.uuid, taskDescriptor.uuid, profile, descriptorName, payload)

    if (isInvokeError(result)) {
      throw new Error(`Task invocation failed: ${result.error}`)
    }

    console.log('Success! Task invoked successfully.')
    return result?.responsePayload
  }
})

