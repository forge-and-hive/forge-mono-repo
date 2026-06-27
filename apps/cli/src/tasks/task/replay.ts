// TASK: replay
// Run this task with:
// forge task:run task:replay

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import { createClientFromForgeConf, type ExecutionRecord } from '@forgehive/hive-sdk'
import { create as bundleCreate } from '../bundle/create'
import { load as bundleLoad } from '../bundle/load'
import { load as loadConf } from '../conf/load'
import { loadCurrent as loadCurrentProfile } from '../auth/loadCurrent'
import { type ForgeConf, type Profile } from '../types'

// Define the fixture structure type
interface Fixture {
  fixtureUUID: string;
  taskName: string;
  projectName: string;
  type: 'success' | 'error';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  boundaries: Record<string, unknown>;
  context: Record<string, unknown>;
}

const description = 'Replay a task execution from a specified path'

const schema = new Schema({
  descriptorName: Schema.string().describe('The task descriptor name to replay (e.g. domain:taskName)'),
  path: Schema.string().describe('Path to the execution log fixture to replay'),
  cache: Schema.string().describe('Cache mode for boundaries during replay').optional()
})

const boundaries = {
  readFixture: async (filePath: string): Promise<Fixture> => {
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const parsedData = JSON.parse(fileContent) as Fixture

    return parsedData
  },
  loadConf: loadConf.asBoundary(),
  loadCurrentProfile: loadCurrentProfile.asBoundary(),
  bundleCreate: bundleCreate.asBoundary(),
  bundleLoad: bundleLoad.asBoundary(),
  ensureBuildsFolder: async (): Promise<string> => {
    const buildsPath = path.join(os.homedir(), '.forge', 'builds')
    try {
      await fs.access(buildsPath)
    } catch {
      await fs.mkdir(buildsPath, { recursive: true })
    }

    return buildsPath
  },
  verifyLogFolder: async (logsPath: string): Promise<boolean> => {
    // return true if the folder exists
    try {
      await fs.access(logsPath)
    } catch (error) {
      return false
    }

    return true
  },
  sendLogToAPI: async (
    profile: Profile,
    record: ExecutionRecord,
    fixtureUUID: string
  ): Promise<{ success: boolean; logUuid?: string }> => {
    try {
      // Use createClientFromForgeConf to automatically load forge.json with task UUIDs
      const client = createClientFromForgeConf('./forge.json', {
        apiKey: profile.apiKey,
        apiSecret: profile.apiSecret,
        host: profile.url,
        metadata: {
          environment: 'cli',
          replayFrom: fixtureUUID
        }
      })

      console.log('===============================================')
      console.log('Sending replay log to Hive...')
      const result = await client.sendLog(record)

      if (result === 'success' || (typeof result === 'object' && 'uuid' in result)) {
        console.log('✅ Log sent to API...', profile.name, profile.url)
        console.log('Replay from fixture UUID:', fixtureUUID)
        console.log('===============================================')

        if (typeof result === 'object' && result && 'uuid' in result) {
          return { success: true, logUuid: result.uuid }
        }

        return { success: true }
      } else {
        console.error('❌ Failed to send log to Hive')
        console.log('===============================================')
        return { success: false }
      }
    } catch (e) {
      const error = e as Error
      console.error('❌ Failed to send log to API:', error.message)
      console.log('===============================================')
      return { success: false }
    }
  }
}

export const replay = createTask({
  schema,
  boundaries,
  fn: async function ({ descriptorName, path: fixturePath, cache }, { readFixture, loadConf, loadCurrentProfile, bundleCreate, bundleLoad, ensureBuildsFolder, verifyLogFolder, sendLogToAPI }) {
    console.log('Input descriptorName:', descriptorName)
    console.log('Input path:', fixturePath)
    console.log('Input cache:', cache)

    // Load forge configuration
    const forge: ForgeConf = await loadConf({})
    const taskDescriptor = forge.tasks[descriptorName as keyof typeof forge.tasks]

    if (taskDescriptor === undefined) {
      throw new Error(`Task ${descriptorName} is not defined in forge.json`)
    }

    // Resolve the fixture path (check if absolute, if not make it relative to logs folder)
    const resolvedFixturePath = path.isAbsolute(fixturePath)
      ? fixturePath
      : path.join(process.cwd(), forge.paths.fixtures, fixturePath)

    // Read the file from the provided path
    const fixture = await readFixture(resolvedFixturePath)

    // Try to load profile, but continue if not found
    let profile = null
    try {
      profile = await loadCurrentProfile({})
    } catch (error) {
      // Profile not found or not configured, continue without it
      console.log('No profile found, logs will not be sent to remote API')
    }

    // Verify if log folder exists
    const logFolderPath = path.join(process.cwd(), forge.paths.logs)
    const logFolderExists = await verifyLogFolder(logFolderPath)
    if (!logFolderExists) {
      throw new Error(`Log folder "${logFolderPath}" does not exist`)
    }

    // Prepare paths
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

    // Configure boundaries based on cache parameter if provided
    const boundaryConfig: Record<string, string> = {}

    if (cache) {
      // Parse the comma-separated list and trim each item
      const cacheBoundaries = cache.split(',').map((b: string) => b.trim())

      // Log which boundaries will use cache mode
      if (cacheBoundaries.length > 0) {
        // Set each specified boundary to 'replay' mode
        cacheBoundaries.forEach((boundary: string) => {
          boundaryConfig[boundary] = 'replay'
        })
      }
    }

    console.log('==================================================')
    console.log('UUID:', fixture.fixtureUUID)
    console.log('Task name:', fixture.taskName)
    console.log('Project name:', fixture.projectName)
    console.log('Context:', fixture.context)
    console.log('==================================================')
    console.log('Replay:', fixture.input)
    console.log('Boundaries:', JSON.stringify(fixture.boundaries, null, 2))
    console.log('==================================================')
    console.log('Boundary config:', boundaryConfig)
    console.log('==================================================')

    // Perform the replay
    const [result, error, record] = await task.safeReplay(
      {
        input: fixture.input,
        output: fixture.output,
        boundaries: fixture.boundaries,
      },
      {
        boundaries: boundaryConfig // Use configured boundary modes
      }
    )

    // Send the log to API if profile is available
    if (profile) {
      try {
        await sendLogToAPI(profile, record, fixture.fixtureUUID)
      } catch (e) {
        console.error('Failed to send log to API:', e)
      }
    }

    if (error) {
      throw new Error(error.message)
    }

    return result
  }
})

replay.setDescription(description)
