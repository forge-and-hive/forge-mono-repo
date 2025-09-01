/* eslint-disable no-console */
import dotenv from 'dotenv'
import { createClientFromForgeConf } from '@forgehive/hive-sdk'
import { getPrice } from '../tasks/stock/getPrice'

// Load environment variables
dotenv.config()

// Create the Hive client from forge.json
const client = createClientFromForgeConf('./forge.json', {
  metadata: {
    environment: 'development',
    version: '1.0.0'
  }
})

// Example: Direct sendLogByName usage (for one-off logging)
console.log('=== Direct SendLogByName Usage Example ===')
console.log('Client config:', client.getConf())

async function main(): Promise<void> {
  try {
    console.log('Testing client configuration...')
    const configTest = await client.testConfig()
    console.log('Config test result:', configTest)

    console.log('Running tasks with direct logging...')

    const [, , record] = await getPrice.safeRun({ ticker: 'NVDA' })
    const name = getPrice.getName() ?? ''
    console.log('Name:', name)

    // Manually log this specific execution using sendLogByName
    if (record) {
      const logResult = await client.sendLogByName(name, record, {
        environment: 'main',
        method: 'direct',
        manual: 'true'
      })
      console.log('Direct logging result:', logResult)
    }

    console.log('\n=== Example completed ===')
  } catch (error) {
    console.error('Error in main:', error)
  }
}

// Run the main function
main().catch(console.error)
