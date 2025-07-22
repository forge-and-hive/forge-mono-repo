// TASK: fingerprint
// Run this task with:
// forge task:run bundle:fingerprint --descriptorName task-name

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import esbuild from 'esbuild'
import fs from 'fs/promises'
import path from 'path'

import { load as loadConf } from '../conf/load'
import { analyzeTaskFile, TaskFingerprintOutput } from '../../utils/taskAnalysis'

interface TaskFingerprint {
  name: string
  description?: string
  location: {
    file: string
    line: number
    column: number
  }
  inputSchema: TaskFingerprintOutput['inputSchema']
  outputType: TaskFingerprintOutput['outputType']
  boundaries: TaskFingerprintOutput['boundaries']
  errors: TaskFingerprintOutput['errors']
  analysisMetadata: TaskFingerprintOutput['analysisMetadata']
  hash: string
}

interface EsbuildResultWithFingerprints extends esbuild.BuildResult {
  fingerprints?: TaskFingerprint[]
}

interface FingerprintResult {
  tasks: TaskFingerprintOutput[]
  buildInfo: {
    entryPoint: string
    outputFile: string
    fingerprintsFile?: string
    totalTasks: number
    buildTimestamp: string
  }
}

const description = 'Generate task bundle with comprehensive fingerprinting and type extraction'

const schema = new Schema({
  descriptorName: Schema.string(),
  filePath: Schema.string().optional()
})

const boundaries = {
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },
  loadConf: loadConf.asBoundary(),
  readFile: async (filePath: string): Promise<string> => {
    return fs.readFile(filePath, 'utf-8')
  },
  writeFile: async (filePath: string, content: string): Promise<void> => {
    return fs.writeFile(filePath, content)
  },
  ensureFingerprintsFolder: async (cwd: string, conf: { paths?: { fingerprints?: string } }): Promise<string> => {
    const fingerprintsPath = path.join(cwd, conf.paths?.fingerprints || 'fingerprints/')
    try {
      await fs.access(fingerprintsPath)
    } catch {
      await fs.mkdir(fingerprintsPath, { recursive: true })
    }
    return fingerprintsPath
  }
}

// esbuild plugin for fingerprinting
function taskFingerprintPlugin(): esbuild.Plugin {
  return {
    name: 'task-fingerprint',
    setup(build): void {
      const fingerprints: TaskFingerprint[] = []

      build.onLoad({ filter: /\.ts$/ }, async (args) => {
        const sourceCode = await fs.readFile(args.path, 'utf-8')

        // Only analyze files that contain createTask
        if (sourceCode.includes('createTask')) {
          const taskFingerprint = analyzeTaskFile(sourceCode, args.path)
          if (taskFingerprint) {
            // Convert to full TaskFingerprint for plugin compatibility
            const fullFingerprint: TaskFingerprint = {
              name: path.basename(args.path, '.ts'),
              description: taskFingerprint.description,
              location: {
                file: args.path,
                line: 1,
                column: 1
              },
              inputSchema: taskFingerprint.inputSchema,
              outputType: taskFingerprint.outputType,
              boundaries: taskFingerprint.boundaries,
              errors: taskFingerprint.errors,
              analysisMetadata: taskFingerprint.analysisMetadata,
              hash: 'generated-hash'
            }
            fingerprints.push(fullFingerprint)
          }
        }

        return null // Let esbuild handle the file normally
      })

      build.onEnd((result): void => {
        // Store fingerprints for later use
        (result as EsbuildResultWithFingerprints).fingerprints = fingerprints
      })
    }
  }
}

export const fingerprint = createTask({
  schema,
  boundaries,
  fn: async function ({ descriptorName, filePath }, {
    getCwd,
    loadConf,
    readFile,
    writeFile,
    ensureFingerprintsFolder
  }) {
    // If filePath is provided, analyze that file directly and return JSON
    if (filePath) {
      console.log(`Analyzing task file: ${filePath}`)
      const sourceCode = await readFile(filePath)
      const fingerprintOutput = analyzeTaskFile(sourceCode, filePath)

      if (!fingerprintOutput) {
        throw new Error('Could not extract fingerprint from task file: ' + filePath)
      }

      // Write fingerprint to file for consistency
      const cwd = await getCwd()
      const forgeJson = await loadConf({})
      const fingerprintsPath = await ensureFingerprintsFolder(cwd, forgeJson)
      const fingerprintFile = path.join(fingerprintsPath, `${descriptorName}.fingerprint.json`)

      const analysis = {
        taskFingerprint: fingerprintOutput
      }

      await writeFile(fingerprintFile, JSON.stringify(analysis, null, 2))
      console.log(`Fingerprint saved to: ${fingerprintFile}`)

      return {
        taskFingerprint: fingerprintOutput,
        fingerprintFile
      }
    }

    // Original bundle logic when no filePath is provided
    const cwd = await getCwd()
    const forgeJson = await loadConf({})

    const taskDescriptor = forgeJson.tasks[descriptorName as keyof typeof forgeJson.tasks]

    if (taskDescriptor === undefined) {
      throw new Error(`Task "${descriptorName}" is not defined in forge.json`)
    }

    const entryPoint = path.join(cwd, taskDescriptor.path)
    const fingerprintsPath = await ensureFingerprintsFolder(cwd, forgeJson)
    const outputFile = path.join(fingerprintsPath, `${descriptorName}.js`)
    const fingerprintsFile = path.join(fingerprintsPath, `${descriptorName}.fingerprints.json`)

    console.log(`Generating bundle with fingerprints for task: ${descriptorName}`)
    console.log(`Entry point: ${entryPoint}`)
    console.log(`Output: ${outputFile}`)

    // Build with fingerprinting plugin
    const result = await esbuild.build({
      entryPoints: [entryPoint],
      outfile: outputFile,
      bundle: true,
      minify: true,
      platform: 'node',
      sourcemap: true,
      plugins: [taskFingerprintPlugin()],
      metafile: true
    })

    // Extract fingerprints from build result
    const taskFingerprints = (result as EsbuildResultWithFingerprints).fingerprints || []

    // Convert to simplified output format (remove name, location, hash)
    const simplifiedFingerprints: TaskFingerprintOutput[] = taskFingerprints.map((fp: TaskFingerprint) => ({
      description: fp.description,
      inputSchema: fp.inputSchema,
      outputType: fp.outputType,
      boundaries: fp.boundaries,
      errors: fp.errors, // Preserve errors from analyzeTaskFile
      analysisMetadata: fp.analysisMetadata // Preserve metadata from analyzeTaskFile
    }))

    // Create fingerprint result
    const fingerprintResult: FingerprintResult = {
      tasks: simplifiedFingerprints,
      buildInfo: {
        entryPoint,
        outputFile,
        fingerprintsFile,
        totalTasks: simplifiedFingerprints.length,
        buildTimestamp: new Date().toISOString()
      }
    }

    // Write fingerprints to file
    await writeFile(fingerprintsFile, JSON.stringify(fingerprintResult, null, 2))

    console.log(`Generated ${taskFingerprints.length} task fingerprints`)
    console.log(`Fingerprints saved to: ${fingerprintsFile}`)

    return {
      outputFile,
      fingerprintsFile,
      taskFingerprints: {
        totalTasks: taskFingerprints.length,
        tasks: taskFingerprints.map((fp: TaskFingerprint) => ({
          name: fp.name,
          inputType: fp.inputSchema.type,
          outputType: fp.outputType.type,
          boundaryCount: fp.boundaries.length,
          hash: fp.hash
        }))
      }
    }
  }
})

fingerprint.setDescription(description)
