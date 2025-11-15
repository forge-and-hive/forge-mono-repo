/* eslint-disable no-console */
import dotenv from 'dotenv'
import { createClientFromForgeConf } from '@forgehive/hive-sdk'
import { getPrice } from '../tasks/stock/getPrice'

// Load environment variables
dotenv.config()

/**
 * Example 1: Create client and publish logs manually
 *
 * This example shows:
 * 1. How to create a HiveLogClient from forge.json
 * 2. How to run a task
 * 3. How to manually publish logs using sendLog()
 */

// Create the Hive client from forge.json
// This automatically reads projectName and projectUuid from forge.json
const client = createClientFromForgeConf('./forge.json', {
  metadata: {
    environment: 'development',
    version: '1.0.0'
  }
})

console.log('=== Example 1: Create Client & Publish Manually ===\n')

async function main(): Promise<void> {
  try {
    // Step 1: Verify client configuration
    console.log('1. Testing client configuration...')
    const configTest = await client.testConfig()
    console.log('Config test result:', configTest)
    console.log()

    // Step 2: Run a task
    console.log('2. Running stock price task...')
    const [result, error, record] = await getPrice.safeRun({ ticker: 'AAPL' })

    if (error) {
      console.error('Task failed:', error)
      return
    }

    console.log('Task result:', result)
    console.log()

    // Step 3: Manually publish the execution record
    console.log('3. Manually publishing log to Hive...')
    if (record) {
      const logResult = await client.sendLog(record, {
        environment: 'development',
        method: 'manual'
      })
      console.log('Log published:', logResult)
    }

    console.log('\n=== Example completed successfully ===')
  } catch (error) {
    console.error('Error:', error)
  }
}

main().catch(console.error)
