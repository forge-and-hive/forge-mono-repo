// TASK: download
// Run this task with:
// forge task:run fixture:download --uuid [fixture-uuid]

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import axios from 'axios'
import path from 'path'
import fs from 'fs/promises'
import { loadCurrent as loadCurrentProfile } from '../auth/loadCurrent'
import { load as loadConf } from '../conf/load'
import { Profile } from '../types'

// Define the Fixture data structure
interface FixtureData {
  name: string;
  boundaries: Record<string, unknown>;
  [key: string]: unknown;
}

interface FixtureResponse {
  fixture: FixtureData;
  [key: string]: unknown;
}

const description = 'Download a fixture by UUID to a path based on task descriptor returned from API'

const schema = new Schema({
  uuid: Schema.string().describe('The UUID of the fixture to download')
})

const boundaries = {
  loadCurrentProfile: loadCurrentProfile.asBoundary(),
  loadConf: loadConf.asBoundary(),
  downloadFixture: async (uuid: string, profile: Profile): Promise<FixtureResponse> => {
    const downloadUrl = `${profile.url}/api/fixture/${uuid}`

    console.log(`Downloading fixture from ${downloadUrl}...`)

    const authToken = `${profile.apiKey}:${profile.apiSecret}`
    const response = await axios.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })

    return response.data
  },
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },
  persistFixture: async (filePath: string, data: FixtureData): Promise<{ path: string }> => {
    const dirPath = path.dirname(filePath)

    await fs.mkdir(dirPath, { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

    return {
      path: filePath
    }
  }
}

export const download = createTask({
  schema,
  boundaries,
  fn: async function ({ uuid }, {
    downloadFixture,
    getCwd,
    persistFixture,
    loadCurrentProfile,
    loadConf
  }) {
    console.log('==================================================')
    console.log(`Attempting to download fixture with uuid: ${uuid}`)
    console.log('==================================================')

    const profile = await loadCurrentProfile({})
    const cwd = await getCwd()
    const forge = await loadConf({})

    // Download from hive api server first to get the task descriptor
    let response
    try {
      response = await downloadFixture(uuid, profile)
    } catch (e: unknown) {
      const error = e as { status?: number, message: string }
      console.error('Error downloading fixture:', error.message, error.status)

      if (error.status === 404) {
        throw new Error('Fixture not found')
      }

      throw new Error('Failed to download fixture')
    }

    const fixture = response.fixture as FixtureData
    const taskName = fixture.taskName as string

    // Determine the output path using forge fixtures path and task descriptor
    const fixturesBasePath = forge.paths.fixtures || 'fixtures'
    const fixtureDir = path.join(fixturesBasePath, taskName)
    const fixturePath = path.join(fixtureDir, `${uuid}.json`)
    const filePath = path.resolve(cwd, fixturePath)

    // Persist fixture to file
    await persistFixture(filePath, response.fixture)

    // Get the relative path for display in the replay command
    const shortPath = path.join(taskName, `${uuid}.json`)

    console.log(`
==================================================
Fixture download completed!
==================================================
Fixture UUID: ${uuid}
Task Name: ${taskName}
Saved to: ${filePath}
==================================================
Boundaries: ${Object.keys(fixture.boundaries).join(', ')}
==================================================
Replay with:
forge task:replay ${taskName} --path ${shortPath}
==================================================
    `)

    return {
      status: 'Downloaded',
      path: filePath,
      shortPath: shortPath
    }
  }
})

download.setDescription(description)
