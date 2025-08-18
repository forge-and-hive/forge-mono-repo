import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'
import { v4 as uuidv4 } from 'uuid'

import Handlebars from 'handlebars'
import path from 'path'
import fs from 'fs/promises'
import { camelCase } from '../../utils/camelCase'

import { load } from '../conf/load'
import { type TaskName, type ForgeConf } from '../types'

// Define the template content directly in the code
// This eliminates the need to find and load an external file
const TASK_TEMPLATE = `// TASK: {{ taskName }}
// Run this task with:
// forge task:run {{ taskDescriptor }}

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

const name = '{{ taskDescriptor }}'
const description = 'Add task description here'

const schema = new Schema({
  // Add your schema definitions here
  // example: myParam: Schema.string()
})

const boundaries = {
  // Add your boundary functions here
  // example: readFile: async (path: string) => fs.readFile(path, 'utf-8')
}

export const {{ taskName }} = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function (argv, boundaries) {
    console.log('input:', argv)
    console.log('boundaries:', Object.keys(boundaries))
    // Your task implementation goes here

    return {}
  }
})

`

const schema = new Schema({
  descriptorName: Schema.string()
})

const boundaries = {
  // Load boundaries
  loadConf: load.asBoundary(),
  loadTemplate: async (): Promise<string> => {
    return TASK_TEMPLATE
  },
  getCwd: async (): Promise<string> => {
    return process.cwd()
  },
  parseTaskName: async (taskDescriptor: string): Promise<TaskName> => {
    const res: string[] = taskDescriptor.split(':')

    if (res.length === 1) {
      return {
        descriptor: `${camelCase(res[0])}`,
        taskName: `${camelCase(res[0])}`,
        fileName: `${camelCase(res[0])}.ts`
      }
    }

    return {
      dir: res[0],
      descriptor: `${res[0]}:${camelCase(res[1])}`,
      taskName: `${camelCase(res[1])}`,
      fileName: `${camelCase(res[1])}.ts`
    }
  },

  // Persist boundaries
  persistTask: async (dir: string, fileName: string, content: string, cwd: string): Promise<{ path: string }> => {
    const dirPath = path.resolve(cwd, dir)
    const taskPath = path.resolve(dirPath, fileName)

    let err
    try {
      await fs.stat(taskPath)
    } catch (e) {
      err = e
    }

    if (err === undefined) {
      throw new Error(`File '${taskPath}' already exists.`)
    }

    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(taskPath, content, 'utf-8')

    return {
      path: taskPath.toString()
    }
  },
  persistConf: async (forge: ForgeConf, cwd: string): Promise<void> => {
    const forgePath = path.join(cwd, 'forge.json')
    await fs.writeFile(forgePath, JSON.stringify(forge, null, 2))
  }
}

export const createTaskCommand = createTask({
  schema,
  boundaries,
  fn: async function ({ descriptorName }, {
    loadTemplate,
    persistTask,
    loadConf,
    persistConf,
    parseTaskName,
    getCwd
  }) {
    const { taskName, fileName, descriptor, dir } = await parseTaskName(descriptorName)
    const cwd = await getCwd()

    const forge = await loadConf({})
    let taskPath: string = forge.paths.tasks

    if (dir !== undefined) {
      taskPath = path.join(taskPath, dir)
    }

    console.log(`
    ==================================================
    Starting task creation!
    Creating: ${taskName}
    Descriptor: ${descriptor}
    Dir:  ${dir ?? ''}
    Into: ${taskPath}
    ==================================================
    `)

    const template = await loadTemplate()
    const comp = Handlebars.compile(template)
    const content = comp({
      taskName,
      taskDescriptor: descriptor
    })

    await persistTask(taskPath, fileName, content, cwd)

    if (forge.tasks === undefined) {
      forge.tasks = {}
    }

    forge.tasks[descriptor] = {
      path: `${taskPath}/${fileName}`,
      handler: taskName,
      uuid: uuidv4()
    }

    await persistConf(forge, cwd)

    return { taskPath, fileName }
  }
})
