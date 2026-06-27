// TASK: download
// Run this task with:
// forge task:run task:download --descriptorName [name] --uuid [task-uuid]

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import axios from 'axios'
import path from 'path'
import fs from 'fs/promises'
import { camelCase } from '../../utils/camelCase'
import { load as loadConf } from '../conf/load'
import { loadCurrent as loadCurrentProfile } from '../auth/loadCurrent'
import { Profile, type ForgeConf } from '../types'

const schema = new Schema({
  descriptorName: Schema.string().describe('The task descriptor name (e.g. domain:taskName)'),
  uuid: Schema.string().describe('The UUID of the task version to download')
})

const boundaries = {
  loadCurrentProfile: loadCurrentProfile.asBoundary(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  downloadTask: async (uuid: string, profile: Profile): Promise<any> => {
    const downloadUrl = `${profile.url}/api/tasks/download`

    console.log(`Downloading task from ${downloadUrl}...`)

    const authToken = `${profile.apiKey}:${profile.apiSecret}`
    const response = await axios.post(downloadUrl, { uuid }, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })

    return response.data
  },
  loadConf: loadConf.asBoundary(),
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },
  parseTaskName: async (taskDescriptor: string): Promise<{
    descriptor: string
    taskName: string
    fileName: string
    dir?: string
  }> => {
    const res: string[] = taskDescriptor.split(':')

    if (res.length === 1) {
      return {
        descriptor: `${camelCase(res[0])}`,
        taskName: `${camelCase(res[0])}`,
        fileName: `${camelCase(res[0])}.ts`
      }
    }

    return {
      dir: res[0],
      descriptor: `${res[0]}:${camelCase(res[1])}`,
      taskName: `${camelCase(res[1])}`,
      fileName: `${camelCase(res[1])}.ts`
    }
  },
  persistTask: async (dir: string, fileName: string, content: string, cwd: string): Promise<{ path: string }> => {
    const dirPath = path.resolve(cwd, dir)
    const taskPath = path.resolve(dirPath, fileName)

    await fs.mkdir(dirPath, { recursive: true })
    await fs.writeFile(taskPath, content, 'utf-8')


    return {
      path: taskPath.toString()
    }
  },
  persistConf: async (forge: ForgeConf, cwd: string): Promise<void> => {
    const forgePath = path.join(cwd, 'forge.json')
    await fs.writeFile(forgePath, JSON.stringify(forge, null, 2))
  },
  checkTaskExists: async (dir: string, fileName: string): Promise<boolean> => {
    const taskPath = path.resolve(dir, fileName)

    try {
      await fs.access(taskPath)
      return true
    } catch {
      return false
    }
  }
}

export const download = createTask({
  schema,
  boundaries,
  fn: async function ({ descriptorName, uuid }, {
    downloadTask,
    getCwd,
    parseTaskName,
    persistTask,
    loadConf,
    persistConf,
    checkTaskExists,
    loadCurrentProfile
  }) {
    console.log(`Attempting to download task with descriptor: ${descriptorName} and uuid: ${uuid}`)

    // Parse descriptor name to get task details
    const { taskName, fileName, descriptor, dir } = await parseTaskName(descriptorName)
    const profile = await loadCurrentProfile({})
    const cwd = await getCwd()
    const forge = await loadConf({})

    let taskPath: string = forge.paths.tasks

    if (dir !== undefined) {
      taskPath = path.join(taskPath, dir)
    }

    // Check if task already exists
    const taskExists = await checkTaskExists(taskPath, fileName)
    if (taskExists) {
      console.log(`Task ${descriptor} already exists at ${taskPath}/${fileName}`)
      return {
        error: 'Task already exists',
        taskPath: `${taskPath}/${fileName}`,
        descriptor
      }
    }

    // Download from hive api server
    let response
    try {
      response = await downloadTask(uuid, profile)
    } catch (e: unknown) {
      const error = e as { status: number, message: string }
      console.error('Error downloading task:', error.message, error.status)

      if (error.status === 404) {
        return {
          error: 'Task not found',
          taskPath: `${taskPath}/${fileName}`,
          descriptor
        }
      }

      return {
        error: 'Failed to download task',
        message: error.message,
        taskPath: `${taskPath}/${fileName}`,
        descriptor
      }
    }

    console.log(`
    ==================================================
    Starting task download!
    Creating: ${taskName}
    Dir:  ${dir ?? ''}
    Into: ${taskPath}
    ==================================================
    `)

    console.log('Writing task file:', taskPath, fileName)
    console.log('Handler:', response.handler)
    console.log('Source code:', response.sourceCode)

    // Persist task with cwd
    await persistTask(taskPath, fileName, response.sourceCode, cwd)

    // Update forge.json with the new task
    if (forge.tasks === undefined) {
      forge.tasks = {}
    }

    forge.tasks[descriptor] = {
      path: `${taskPath}/${fileName}`,
      handler: response.handler
    }

    console.log('Forge:', forge)

    await persistConf(forge, cwd)

    return {
      taskPath,
      fileName,
      descriptor,
      handler: response.handler
    }
  }
})
