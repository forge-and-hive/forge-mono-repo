// TASK: sync
// Run this task with:
// forge task:run project:sync

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import { v4 as uuidv4 } from 'uuid'

import { load } from '../conf/load'
import { loadCurrent } from '../auth/loadCurrent'
import { type ForgeConf } from '../types'
import path from 'path'
import fs from 'fs/promises'

const schema = new Schema({})

const boundaries = {
  loadConf: load.asBoundary(),
  loadCurrentProfile: loadCurrent.asBoundary(),
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },
  persistConf: async (forge: ForgeConf, cwd: string): Promise<void> => {
    const forgePath = path.join(cwd, 'forge.json')
    await fs.writeFile(forgePath, JSON.stringify(forge, null, 2))
  },
  syncTasksToHive: async (
    projectUuid: string,
    tasks: Array<{ uuid: string; name: string }>,
    apiKey: string,
    apiSecret: string,
    baseUrl: string
  ): Promise<{
    success: boolean
    error?: string
    data?: {
      projectUuid: string
      projectName: string
      summary: {
        total: number
        created: number
        updated: number
        errors: number
      }
      results: {
        created: Array<{ uuid: string; taskName: string; action: string }>
        updated: Array<{ uuid: string; taskName: string; previousName: string; action: string }>
        errors: Array<{ uuid: string; taskName: string; error: string }>
      }
    }
  }> => {
    try {
      const url = `${baseUrl}/api/projects/${projectUuid}/sync`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}:${apiSecret}`
        },
        body: JSON.stringify({ tasks })
      })

      if (response.ok) {
        const data = await response.json()
        return { success: true, data }
      } else {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status} - ${response.statusText}` }))
        return { success: false, error: errorData.error || `HTTP ${response.status} - ${response.statusText}` }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }
}

export const sync = createTask({
  schema,
  boundaries,
  fn: async function (_argv, {
    loadConf,
    loadCurrentProfile,
    getCwd,
    persistConf,
    syncTasksToHive
  }) {
    const cwd = await getCwd()
    const forge = await loadConf({})

    // Check if project has UUID
    if (!forge.project.uuid) {
      throw new Error('Project does not have a UUID. Please run "forge project:link" to connect to a Hive project.')
    }

    console.log(`
    ==================================================
    Starting project sync to Hive!
    Project: ${forge.project.name}
    UUID: ${forge.project.uuid}
    ==================================================
    `)

    // Ensure all tasks have UUIDs and collect them for sync
    let configUpdated = false
    const tasksToSync: Array<{ uuid: string; name: string }> = []

    if (!forge.tasks) {
      forge.tasks = {}
    }

    for (const [taskDescriptor, taskData] of Object.entries(forge.tasks)) {
      if (!taskData.uuid) {
        taskData.uuid = uuidv4()
        configUpdated = true
        console.log(`  ➕ Generated UUID for task: ${taskDescriptor}`)
      }
      
      // Use the task descriptor (key) as the name for the API
      const taskName = taskDescriptor
      tasksToSync.push({
        uuid: taskData.uuid,
        name: taskName
      })
    }

    // Save config if we added UUIDs
    if (configUpdated) {
      await persistConf(forge, cwd)
      console.log(`  💾 Updated forge.json with new UUIDs`)
    }

    if (tasksToSync.length === 0) {
      console.log(`  ℹ️  No tasks found to sync`)
      return { status: 'no-tasks', message: 'No tasks found in project' }
    }

    console.log(`  📊 Found ${tasksToSync.length} tasks to sync`)

    try {
      const profile = await loadCurrentProfile({})
      const result = await syncTasksToHive(
        forge.project.uuid,
        tasksToSync,
        profile.apiKey,
        profile.apiSecret,
        profile.url
      )

      if (result.success && result.data) {
        const { summary, results } = result.data

        console.log(`\n  ✅ Sync completed successfully!`)
        console.log(`     Total tasks: ${summary.total}`)
        console.log(`     Created: ${summary.created}`)
        console.log(`     Updated: ${summary.updated}`)
        console.log(`     Errors: ${summary.errors}`)

        if (results.created.length > 0) {
          console.log(`\n  🆕 Created tasks:`)
          results.created.forEach(task => {
            console.log(`     • ${task.taskName} (${task.uuid})`)
          })
        }

        if (results.updated.length > 0) {
          console.log(`\n  🔄 Updated tasks:`)
          results.updated.forEach(task => {
            console.log(`     • ${task.taskName} (was: ${task.previousName}) (${task.uuid})`)
          })
        }

        if (results.errors.length > 0) {
          console.log(`\n  ❌ Tasks with errors:`)
          results.errors.forEach(task => {
            console.log(`     • ${task.taskName}: ${task.error} (${task.uuid})`)
          })
        }

        const projectUrl = `${profile.url}/dashboard/projects/${forge.project.uuid}`
        console.log(`\n  🔗 View your project: ${projectUrl}`)

        return {
          status: 'success',
          summary,
          results,
          projectUrl
        }
      } else {
        throw new Error(result.error || 'Unknown sync error')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('No default profile')) {
        console.log(`\n  ⚠️  No authentication profile found. Run "forge auth:add" to configure.`)
        return { status: 'no-auth', message: 'No authentication profile configured' }
      } else {
        console.log(`\n  ❌ Sync failed: ${errorMessage}`)
        return { status: 'error', message: errorMessage }
      }
    }
  }
})