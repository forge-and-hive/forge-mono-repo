// TASK: download
// Run this task with:
// forge task:run docs:download
// forge task:run docs:download --path="custom/path/forge.md"

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import path from 'path'

const name = 'docs:download'
const description = 'Download the ForgeHive LLM guide from GitHub to local project'

const LLM_GUIDE_URL = 'https://raw.githubusercontent.com/forge-and-hive/forge-mono-repo/refs/heads/main/docs/llm.md'

const schema = new Schema({
  path: Schema.string().optional()
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
  fn: async function ({ path: customPath }, { fetchFile, getCurrentWorkingDirectory, createDirectory, writeFile, checkFileExists }) {
    // Determine the target path
    const targetPath = customPath || 'docs/forge.md'
    const cwd = await getCurrentWorkingDirectory()
    const fullPath = path.resolve(cwd, targetPath)
    const dirPath = path.dirname(fullPath)

    console.log(`Downloading ForgeHive LLM guide to: ${targetPath}`)

    // Check if file already exists
    const fileExists = await checkFileExists(fullPath)
    if (fileExists) {
      console.log(`Warning: File already exists at ${targetPath}. It will be overwritten.`)
    }

    // Download the file content
    const content = await fetchFile(LLM_GUIDE_URL)

    // Create directory if it doesn't exist
    await createDirectory(dirPath)

    // Write the file
    await writeFile(fullPath, content)

    console.log(`✅ Successfully downloaded ForgeHive LLM guide to ${targetPath}`)

    return {
      success: true,
      filePath: fullPath,
      targetPath,
      size: content.length
    }
  }
})
