/* eslint-disable no-console */
import dotenv from 'dotenv'
import { createHiveClient, isInvokeError } from '@forgehive/hive-sdk'
import fs from 'fs'

// Load environment variables
dotenv.config()

/**
 * Example 3: Invoke a task remotely
 *
 * This example shows:
 * 1. How to create a HiveClient for task invocation
 * 2. How to look up task UUIDs from forge.json
 * 3. How to invoke a task remotely on the Hive platform
 */

console.log('=== Example 3: Invoke Task Remotely ===\n')

interface ForgeConfig {
  project: {
    name: string
    uuid: string
  }
  tasks: {
    [taskName: string]: {
      path: string
      handler: string
      uuid: string
    }
  }
}

async function invokeTask(): Promise<void> {
  // Step 1: Load forge.json to get project UUID and task UUID
  console.log('1. Loading forge.json configuration...')
  const forgeConfigPath = './forge.json'

  if (!fs.existsSync(forgeConfigPath)) {
    console.error('Error: forge.json not found at', forgeConfigPath)
    return
  }

  const forgeConfig: ForgeConfig = JSON.parse(fs.readFileSync(forgeConfigPath, 'utf8'))
  const projectUuid = forgeConfig.project.uuid

  // Look up task UUID
  const taskName = 'stock:getPrice'
  const taskConfig = forgeConfig.tasks[taskName]

  if (!taskConfig) {
    console.error(`Error: Task "${taskName}" not found in forge.json`)
    return
  }

  const taskUuid = taskConfig.uuid
  console.log(`Project UUID: ${projectUuid}`)
  console.log(`Task: ${taskName}`)
  console.log(`Task UUID: ${taskUuid}`)
  console.log()

  // Step 2: Create HiveClient for task invocation
  console.log('2. Creating HiveClient...')
  const client = createHiveClient({
    projectUuid,
    apiKey: process.env.HIVE_API_KEY,
    apiSecret: process.env.HIVE_API_SECRET,
    host: process.env.HIVE_HOST
  })
  console.log('Client created')
  console.log()

  // Step 3: Invoke the task
  console.log('3. Invoking task remotely...')
  const payload = { ticker: 'AAPL' }
  console.log('Payload:', payload)
  console.log()

  try {
    const result = await client.invoke(taskUuid, payload)

    if (isInvokeError(result)) {
      console.error('❌ Error invoking task:', result.error)
    } else if (result) {
      console.log('✓ Task invoked successfully!')
      console.log('Response:', result.responsePayload)
    } else {
      console.error('❌ Failed to invoke task: null result')
    }

    console.log('\n=== Example completed ===')
  } catch (error) {
    console.error('Error:', error)
  }
}

if (require.main === module) {
  invokeTask().catch(console.error)
}
