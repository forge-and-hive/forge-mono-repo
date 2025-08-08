// TASK: info
// Run this task with:
// forge task:run conf:info

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import * as fs from 'fs'
import * as path from 'path'

import { loadCurrent as loadCurrentProfile } from '../auth/loadCurrent'
import { load as loadConfig } from '../conf/load'

const schema = new Schema({})

const boundaries = {
  readFile: async (filePath: string): Promise<string> => fs.promises.readFile(filePath, 'utf-8'),
  loadConfig: loadConfig.asBoundary(),
  loadCurrentProfile: loadCurrentProfile.asBoundary()
}

export const info = createTask({
  schema,
  boundaries,
  fn: async function (_argv, { loadCurrentProfile, loadConfig, readFile }) {
    const packageJsonPath = path.join(__dirname, '../../../package.json')

    const packageJsonContent = await readFile(packageJsonPath)
    const packageJson = JSON.parse(packageJsonContent)

    let config
    try {
      config = await loadConfig({})
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.log('============ Forge CLI Information ============')
        console.log('===============================================')
        console.log()
        console.log(`Version: ${packageJson.version}`)
        console.log()
        console.log('❌ No forge.json file found in current directory.')
        console.log('   Run "forge init" to create a new Forge project.')
        console.log()
        console.log('===============================================')
        return {
          version: packageJson.version,
          profile: null,
          paths: null,
          error: 'No forge.json found'
        }
      }
      throw error
    }

    // Display human-friendly information
    console.log('===============================================')
    console.log('============ Forge CLI Information ============')
    console.log()
    console.log(`Version: ${packageJson.version}`)
    console.log()

    console.log('Configuration Paths:')
    console.log(`  Logs: ${config.paths.logs}`)
    console.log(`  Fixtures: ${config.paths.fixtures}`)
    console.log(`  Fingerprints: ${config.paths.fingerprints}`)
    console.log()

    let profile
    try {
      profile = await loadCurrentProfile({})
      console.log('Current Profile:')
      console.log(`  Name: ${profile.name}`)
      console.log(`  URL: ${profile.url}`)
      console.log(`  API Key: ${profile.apiKey}`)
    } catch (error) {
      console.log('Current Profile: No default profile set')
      console.log('  Run "forge task:run auth:add" to create a profile.')
    }

    console.log()
    console.log('===============================================')

    return {
      version: packageJson.version,
      profile: profile ? {
        name: profile.name,
        url: profile.url,
        apiKey: profile.apiKey
      } : null,
      paths: {
        logs: config.paths.logs,
        fixtures: config.paths.fixtures,
        fingerprints: config.paths.fingerprints
      }
    }
  }
})
