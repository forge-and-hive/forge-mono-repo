// TASK: describe
// Run this task with:
// forge task:run task:describe

import path from 'path'
import os from 'os'
import fs from 'fs/promises'

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

import { create as bundleCreate } from '../bundle/create'
import { load as bundleLoad } from '../bundle/load'
import { load as loadConf } from '../conf/load'
import { type ForgeConf } from '../types'

const description = 'Describe a task with detailed information about its schema, boundaries and configuration'

const schema = new Schema({
  descriptorName: Schema.string().describe('The task descriptor name to describe (e.g. domain:taskName)')
})

const boundaries = {
  loadConf: loadConf.asBoundary(),
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
  }
}

export const describe = createTask({
  schema,
  boundaries,
  fn: async function ({ descriptorName }, {
    loadConf,
    bundleCreate,
    bundleLoad,
    ensureBuildsFolder
  }) {
    // Load forge configuration
    const forge: ForgeConf = await loadConf({})
    const taskDescriptor = forge.tasks[descriptorName as keyof typeof forge.tasks]

    if (taskDescriptor === undefined) {
      throw new Error(`Task "${descriptorName}" is not defined in forge.json`)
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

    console.log('===============================================')
    console.log(`Task: ${descriptorName}`)
    console.log('===============================================')
    console.log(`Path: ${taskDescriptor.path}`)
    console.log(`Handler: ${taskDescriptor.handler}`)

    // Get task description
    const taskDescription = task.getDescription?.() || 'No description available'
    console.log(`Description: ${taskDescription}`)

    console.log('')
    console.log('Schema:')
    console.log('-------')

    // Get schema information
    const taskSchema = task.getSchema?.()
    if (taskSchema && taskSchema.shape) {
      const schemaKeys = Object.keys(taskSchema.shape)
      if (schemaKeys.length === 0) {
        console.log('  No schema parameters defined')
      } else {
        schemaKeys.forEach(key => {
          const field = taskSchema.shape[key]
          const fieldType = field.type || 'unknown'
          const fieldDescription = field.description || ''

          if (fieldDescription) {
            console.log(`  • ${key} (${fieldType}): ${fieldDescription}`)
          } else {
            console.log(`  • ${key} (${fieldType})`)
          }
        })
      }
    } else {
      console.log('  No schema information available')
    }

    console.log('')
    console.log('Boundaries:')
    console.log('-----------')

    // Get boundaries information
    const taskBoundaries = task.getBoundaries?.()
    if (taskBoundaries) {
      const boundaryKeys = Object.keys(taskBoundaries)
      if (boundaryKeys.length === 0) {
        console.log('  No boundaries defined')
      } else {
        boundaryKeys.forEach(boundaryName => {
          console.log(`  • ${boundaryName}`)
        })
      }
    } else {
      console.log('  No boundary information available')
    }

    console.log('===============================================')

    return {
      name: descriptorName,
      path: taskDescriptor.path,
      handler: taskDescriptor.handler,
      description: taskDescription,
      schema: taskSchema?.shape || {},
      boundaries: taskBoundaries ? Object.keys(taskBoundaries) : []
    }
  }
})

describe.setDescription(description)
