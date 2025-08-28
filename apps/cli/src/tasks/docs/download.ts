// TASK: download
// Run this task with:
// forge task:run docs:download
// forge task:run docs:download --path="custom/path/forge.md"
// forge task:run docs:download --logs
// forge task:run docs:download --logs --path="custom/path/forge.md"

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import path from 'path'

const name = 'docs:download'
const description = 'Download ForgeHive LLM guides from GitHub to local project'

const LLM_GUIDE_URL = 'https://raw.githubusercontent.com/forge-and-hive/forge-mono-repo/refs/heads/main/docs/llm.md'
const LLM_HIVE_LOGGING_URL = 'https://raw.githubusercontent.com/forge-and-hive/forge-mono-repo/refs/heads/main/docs/llm-hive-logging.md'

const schema = new Schema({
  path: Schema.string().optional(),
  logs: Schema.boolean().optional()
})

const boundaries = {
  fetchFile: async (url: string): Promise<string> => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
    }
    return await response.text()
  },
  getCurrentWorkingDirectory: async (): Promise<string> => {
    return process.cwd()
  },
  createDirectory: async (dirPath: string): Promise<void> => {
    const fs = await import('fs/promises')
    await fs.mkdir(dirPath, { recursive: true })
  },
  writeFile: async (filePath: string, content: string): Promise<void> => {
    const fs = await import('fs/promises')
    await fs.writeFile(filePath, content, 'utf-8')
  },
  checkFileExists: async (filePath: string): Promise<boolean> => {
    const fs = await import('fs/promises')
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}

export const download = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function ({ path: customPath, logs }, { fetchFile, getCurrentWorkingDirectory, createDirectory, writeFile, checkFileExists }) {
    const cwd = await getCurrentWorkingDirectory()
    const results = []

    // Download main LLM guide
    const mainTargetPath = customPath || 'docs/forge.md'
    const mainFullPath = path.resolve(cwd, mainTargetPath)
    const mainDirPath = path.dirname(mainFullPath)

    console.log(`Downloading ForgeHive LLM guide to: ${mainTargetPath}`)

    // Check if file already exists
    const mainFileExists = await checkFileExists(mainFullPath)
    if (mainFileExists) {
      console.log(`Warning: File already exists at ${mainTargetPath}. It will be overwritten.`)
    }

    // Download the main guide content
    const mainContent = await fetchFile(LLM_GUIDE_URL)

    // Create directory if it doesn't exist
    await createDirectory(mainDirPath)

    // Write the main guide file
    await writeFile(mainFullPath, mainContent)

    console.log(`✅ Successfully downloaded ForgeHive LLM guide to ${mainTargetPath}`)

    results.push({
      type: 'main',
      filePath: mainFullPath,
      targetPath: mainTargetPath,
      size: mainContent.length
    })

    // Download Hive logging guide if --logs flag is provided
    if (logs) {
      const logsTargetPath = customPath
        ? path.join(path.dirname(customPath), 'hive-logging.md')
        : 'docs/hive-logging.md'
      const logsFullPath = path.resolve(cwd, logsTargetPath)
      const logsDirPath = path.dirname(logsFullPath)

      console.log(`Downloading Hive Logging guide to: ${logsTargetPath}`)

      // Check if logs file already exists
      const logsFileExists = await checkFileExists(logsFullPath)
      if (logsFileExists) {
        console.log(`Warning: File already exists at ${logsTargetPath}. It will be overwritten.`)
      }

      // Download the logs guide content
      const logsContent = await fetchFile(LLM_HIVE_LOGGING_URL)

      // Create directory if it doesn't exist
      await createDirectory(logsDirPath)

      // Write the logs guide file
      await writeFile(logsFullPath, logsContent)

      console.log(`✅ Successfully downloaded Hive Logging guide to ${logsTargetPath}`)

      results.push({
        type: 'logs',
        filePath: logsFullPath,
        targetPath: logsTargetPath,
        size: logsContent.length
      })
    }

    return {
      success: true,
      downloads: results,
      totalFiles: results.length
    }
  }
})
