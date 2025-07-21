// TASK: fingerprint
// Run this task with:
// forge task:run task:fingerprint --descriptorName task-name

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import fs from 'fs/promises'
import path from 'path'

import { load as loadConf } from '../conf/load'
import { fingerprint as bundleFingerprint } from '../bundle/fingerprint'
import { TaskFingerprintOutput } from '../../utils/taskAnalysis'

interface FingerprintAnalysis {
  taskFingerprint: TaskFingerprintOutput
}

const description = 'Analyze a specific task and generate detailed fingerprint without bundling'

const schema = new Schema({
  descriptorName: Schema.string()
})

const boundaries = {
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },
  loadConf: loadConf.asBoundary(),
  bundleFingerprint: bundleFingerprint.asBoundary()
}

export const fingerprint = createTask({
  schema,
  boundaries,
  fn: async function ({ descriptorName }, {
    getCwd,
    loadConf,
    bundleFingerprint
  }) {
    const cwd = await getCwd()
    const forgeJson = await loadConf({})

    const taskDescriptor = forgeJson.tasks[descriptorName as keyof typeof forgeJson.tasks]

    if (taskDescriptor === undefined) {
      throw new Error(`Task "${descriptorName}" is not defined in forge.json`)
    }

    const filePath = path.join(cwd, taskDescriptor.path)

    console.log(`Analyzing task: ${descriptorName}`)
    console.log(`Task file: ${filePath}`)

    // Use bundle:fingerprint with filePath to analyze the task file directly
    const result = await bundleFingerprint({
      descriptorName,
      filePath
    })

    const taskFingerprint = result.taskFingerprint

    if (!taskFingerprint) {
      throw new Error('Could not extract fingerprint from task file')
    }

    console.log('Task fingerprint generated successfully')
    console.log(`Input properties: ${Object.keys(taskFingerprint.inputSchema.properties).join(', ')}`)
    console.log(`Boundaries: ${taskFingerprint.boundaries.map(b => b.name).join(', ')}`)

    return {
      taskName: descriptorName,
      fingerprint: taskFingerprint,
      fingerprintFile: result.fingerprintFile,
      analysis: {
        inputSchemaProps: Object.keys(taskFingerprint.inputSchema.properties),
        boundaryCount: taskFingerprint.boundaries.length,
        hasDescription: !!taskFingerprint.description,
        outputType: taskFingerprint.outputType.type
      }
    }
  }
})

fingerprint.setDescription(description)
