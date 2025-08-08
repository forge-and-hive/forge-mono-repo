// TASK: run
// Run this task with:
// most recursive call on the project
// forge task:run task:run

import path from 'path'
import fs from 'fs/promises'
import os from 'os'

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import { RecordTape } from '@forgehive/record-tape'
import { HiveLogClient, type ExecutionRecord } from '@forgehive/hive-sdk'

import { create as bundleCreate } from '../bundle/create'
import { load as bundleLoad } from '../bundle/load'
import { load as loadConf } from '../conf/load'
import { loadCurrent as loadCurrentProfile } from '../auth/loadCurrent'
import { type ForgeConf, type Profile } from '../types'

// For now, we'll use a simple schema without the record type
// TODO: Use Schema.record once it's properly built and available
const schema = new Schema({
  descriptorName: Schema.string(),
  args: Schema.mixedRecord()
  // args will be passed directly without schema validation for now
})

const boundaries = {
  loadConf: loadConf.asBoundary(),
  loadCurrentProfile: loadCurrentProfile.asBoundary(),
  bundleCreate: bundleCreate.asBoundary(),
  bundleLoad: bundleLoad.asBoundary(),
  ensureLogFolder: async (logsPath: string): Promise<void> => {
    // create the folder if it doesn't exist
    try {
      await fs.access(logsPath)
    } catch (error) {
      await fs.mkdir(logsPath, { recursive: true })
    }
  },
  ensureBuildsFolder: async (): Promise<string> => {
    const buildsPath = path.join(os.homedir(), '.forge', 'builds')
    try {
      await fs.access(buildsPath)
    } catch {
      await fs.mkdir(buildsPath, { recursive: true })
    }

    return buildsPath
  },
  sendLogToAPI: async (profile: Profile, projectName: string, record: ExecutionRecord): Promise<boolean> => {
    try {
      const config = {
        projectName,
        apiKey: profile.apiKey,
        apiSecret: profile.apiSecret,
        host: profile.url,
        metadata: {
          environment: 'cli'
        }
      }

      const client = new HiveLogClient(config)
      const result = await client.sendLog(record)

      if (result === 'success') {
        console.log('===============================================')
        console.log('Log sent to API... ', profile.name, profile.url)
        return true
      } else {
        console.error('Failed to send log to API:', profile.url)
        return false
      }
    } catch (e) {
      console.error('Failed to send log to API:', profile.url)
      const error = e as Error
      console.error('Error:', error.message)
      return false
    }
  }
}

export const run = createTask({
  schema,
  boundaries,
  fn: async function ({ descriptorName, args }, {
    loadConf,
    bundleCreate,
    bundleLoad,
    ensureLogFolder,
    ensureBuildsFolder,
    loadCurrentProfile,
    sendLogToAPI
  }) {
    // Load forge configuration
    const forge: ForgeConf = await loadConf({})
    const taskDescriptor = forge.tasks[descriptorName as keyof typeof forge.tasks]
    const projectName = forge.project.name

    if (taskDescriptor === undefined) {
      throw new Error('Task is not defined on forge.json')
    }

    // Try to load profile, but continue if not found
    let profile = null
    try {
      profile = await loadCurrentProfile({})
    } catch (error) {
      // Profile not found or not configured, continue without it
      console.log('No profile found, logs will not be sent to remote API')
    }

    // Ensure log folder exists
    const logFolderPath = path.join(process.cwd(), forge.paths.logs)
    await ensureLogFolder(logFolderPath)

    // Prepare paths
    const logsPath = path.join(logFolderPath, descriptorName)
    const entryPoint = path.join(process.cwd(), taskDescriptor.path)
    const buildsPath = await ensureBuildsFolder()
    const outputFile = path.join(buildsPath, `${descriptorName}.js`)

    // Bundle the task
    await bundleCreate({
      entryPoint,
      outputFile
    })

    // Load the bundled task
    const bundle = await bundleLoad({
      bundlePath: outputFile
    })

    // Get the task handler
    const task = bundle[taskDescriptor.handler]

    if (!task) {
      throw new Error(`Handler "${taskDescriptor.handler}" not found in bundle`)
    }

    // Setup record tape
    const tape = new RecordTape({
      path: logsPath
    })

    // load record tape
    try {
      await tape.load()

      // Maintain a maximum log length by removing old records
      const maxLogLength = 10

      // Remove records from the beginning until we're within the limit
      while (tape.getLength() >= maxLogLength) {
        tape.shift()
      }
    } catch (_error) {
      // if the tape is not found, create a new one on saving
    }

    // Run the task with provided arguments
    const [result, error, record] = await task.safeRun(args)
    const logItem = tape.push(record, {
      environment: 'cli'
    })
    await tape.save()

    if (profile) {
      try {
        await sendLogToAPI(profile, projectName, logItem)
      } catch (e) {
        console.error('Failed to send log to API:', e)
      }
    }

    if (error) {
      throw error
    }

    return result
  }
})
