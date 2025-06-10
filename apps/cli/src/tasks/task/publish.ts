// TASK: publish
// Run this task with:
// forge task:run task:publish --descriptorMame task-name

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import axios from 'axios'

import path from 'path'
import fs from 'fs/promises'
import os from 'os'

import { load as loadConf } from '../conf/load'
import { create as bundleCreate } from '../bundle/create'
import { load as bundleLoad } from '../bundle/load'
import { zip as bundleZip } from '../bundle/zip'
import { loadCurrent as loadCurrentProfile } from '../auth/loadCurrent'
import { Profile } from '../types'

const schema = new Schema({
  descriptorName: Schema.string()
})

const boundaries = {
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },
  loadConf: loadConf.asBoundary(),
  loadCurrentProfile: loadCurrentProfile.asBoundary(),
  bundleCreate: bundleCreate.asBoundary(),
  bundleLoad: bundleLoad.asBoundary(),
  bundleZip: bundleZip.asBoundary(),
  readFileUtf8: async (filePath: string): Promise<string> => {
    return fs.readFile(filePath, 'utf-8')
  },
  readFileBinary: async (filePath: string): Promise<Buffer> => {
    return fs.readFile(filePath)
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publishTask: async (data: any, profile: Profile): Promise<any> => {
    const publishUrl = `${profile.url}/api/tasks/publish`
    const authToken = `${profile.apiKey}:${profile.apiSecret}`

    try {
      const response = await axios.post(publishUrl, data, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      return response.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.data?.error.includes('Bundle size')) {
        throw new Error('Bundle size exceeds the maximum allowed size of 25MB')
      }

      throw new Error('Failed to publish task source code and metadata')
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadBundleWithPresignedUrl: async (presignedUrl: string, bundleContent: Buffer): Promise<any> => {
    const response = await axios.put(presignedUrl, bundleContent, {
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    })
    return response.status === 200
  },

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

export const publish = createTask(
  schema,
  boundaries,
  async function ({ descriptorName }, {
    getCwd,
    ensureBuildsFolder,
    loadConf,
    bundleCreate,
    bundleLoad,
    bundleZip,
    readFileUtf8,
    readFileBinary,
    publishTask,
    loadCurrentProfile,
    uploadBundleWithPresignedUrl
  }) {
    const cwd = await getCwd()
    const forgeJson = await loadConf({})
    const profile = await loadCurrentProfile({})

    const taskDescriptor = forgeJson.tasks[descriptorName as keyof typeof forgeJson.tasks]
    const projectName = forgeJson.project.name

    if (taskDescriptor === undefined) {
      throw new Error('Task is not defined on forge.json')
    }

    const entryPoint = path.join(cwd, taskDescriptor.path)
    const buildsPath = await ensureBuildsFolder()
    const outputFile = path.join(buildsPath, `${descriptorName}.js`)
    const zipFile = `${descriptorName}.zip`

    // Bundle the task
    await bundleCreate({
      entryPoint,
      outputFile
    })

    console.log('Bundle created...')

    // Zip the bundle
    await bundleZip({
      dir: buildsPath,
      input: `${descriptorName}.js`,
      output: zipFile
    })

    console.log('Bundle zipped...')

    // Load the bundled task
    const bundle = await bundleLoad({
      bundlePath: outputFile
    })

    // Get the task handler
    const task = bundle[taskDescriptor.handler]
    const description = task.getDescription() ?? ''
    const schema = task.getSchema() || new Schema({})
    const boundaries = Object.keys(task.getBoundaries()) || []
    const schemaDescriptor = schema.describe()

    // Read the task file content
    const sourceCode = await readFileUtf8(entryPoint)
    // Read the zipped bundle instead of the raw bundle
    const zipPath = path.join(buildsPath, zipFile)
    const bundleContent = await readFileBinary(zipPath)

    // Get bundle size
    const bundleSize = bundleContent.length

    // First, publish task metadata and get presigned URL for bundle upload
    const data = {
      ...taskDescriptor,
      taskName: descriptorName,
      handler: taskDescriptor.handler,
      projectName,
      description,
      schemaDescriptor: JSON.stringify(schemaDescriptor),
      boundaries,
      sourceCode,
      bundleSize
    }

    // Publish metadata to hive api server
    console.log(`Publishing metadata and source code to ${profile.url}...`)
    const publishResponse = await publishTask(data, profile)

    // Upload zipped bundle using the presigned URL
    if (publishResponse.bundleUploadUrl) {
      console.log('Uploading zipped bundle...')
      await uploadBundleWithPresignedUrl(
        publishResponse.bundleUploadUrl,
        bundleContent
      )

      return {
        descriptor: taskDescriptor,
        publish: true
      }
    } else {
      throw new Error('Bundle upload failed')
    }
  }
)
