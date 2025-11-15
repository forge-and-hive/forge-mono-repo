/* eslint-disable no-console */
import dotenv from 'dotenv'
import { Task } from '@forgehive/task'
import { createClientFromForgeConf } from '@forgehive/hive-sdk'
import { getPrice } from '../tasks/stock/getPrice'

dotenv.config()

/**
 * Example 2: Publish logs by hooking into task execution
 *
 * This example shows:
 * 1. How to create a HiveLogClient from forge.json
 * 2. How to set up a global listener that automatically publishes ALL task executions
 * 3. How tasks are automatically logged without manual intervention
 */

console.log('=== Example 2: Publish Logs by Hook (Global Listener) ===\n')

// Step 1: Create the Hive client from forge.json
const client = createClientFromForgeConf('./forge.json', {
  metadata: {
    environment: 'development',
    version: '1.0.0'
  }
})

// Step 2: Set up global listener - this will automatically log ALL task executions
console.log('1. Setting up global listener for automatic logging...')
Task.listenExecutionRecords(client.getListener())
console.log('   Global listener is now active!\n')

async function main(): Promise<void> {
  try {
    // Step 3: Run tasks - they will be automatically logged
    console.log('2. Running tasks (these will be automatically logged)...\n')

    console.log('   Running AAPL task...')
    const [result1, error1] = await getPrice.safeRun({ ticker: 'AAPL' })
    if (error1) {
      console.error('   Task failed:', error1)
    } else {
      console.log('   Result:', result1)
      console.log('   ✓ Automatically logged to Hive\n')
    }

    console.log('   Running GOOGL task...')
    const [result2, error2] = await getPrice.safeRun({ ticker: 'GOOGL' })
    if (error2) {
      console.error('   Task failed:', error2)
    } else {
      console.log('   Result:', result2)
      console.log('   ✓ Automatically logged to Hive\n')
    }

    console.log('=== Example completed successfully ===')
    console.log('Both task executions were automatically logged without manual sendLog() calls')
  } catch (error) {
    console.error('Error:', error)
  }
}

main().catch(console.error)
