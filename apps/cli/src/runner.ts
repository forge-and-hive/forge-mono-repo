import { Runner, RunnerParsedArguments } from '@forgehive/runner'
import { ParsedArgs } from 'minimist'
import dotenv from 'dotenv'

// Load environment variables from .env file and .env.local file
dotenv.config()
dotenv.config({ path: '.env.local' })

import { init } from './tasks/init'
import { info } from './tasks/conf/info'

import { createTaskCommand } from './tasks/task/createTask'
import { run as taskRunCommand } from './tasks/task/run'
import { remove as taskRemoveCommand } from './tasks/task/remove'
import { publish as publishTask } from './tasks/task/publish'
import { download as downloadTask } from './tasks/task/download'
import { replay as replayTask } from './tasks/task/replay'
import { list as listTasks } from './tasks/task/list'
import { describe as describeTask } from './tasks/task/describe'
import { fingerprint as fingerprintTask } from './tasks/task/fingerprint'
import { invoke as invokeTask } from './tasks/task/invoke'


import { create as createRunner } from './tasks/runner/create'
import { remove as removeRunner } from './tasks/runner/remove'
import { bundle as bundleRunner } from './tasks/runner/bundle'

import { download as downloadFixture } from './tasks/fixture/download'

import { add as addProfile } from './tasks/auth/add'
import { switchProfile } from './tasks/auth/switch'
import { list as listProfiles } from './tasks/auth/list'
import { remove as removeProfile } from './tasks/auth/remove'

interface CliParsedArguments extends RunnerParsedArguments {
  action: string;
}

const runner = new Runner((data: ParsedArgs): CliParsedArguments => {
  const { _, ...filteredObj } = data

  return {
    taskName: String(_[0]),
    action: _[1] ?? '',
    args: filteredObj
  }
})

// Config commands
runner.load('init', init)
runner.load('info', info)

// Task commands
runner.load('task:create', createTaskCommand)
runner.load('task:run', taskRunCommand)
runner.load('task:remove', taskRemoveCommand)
runner.load('task:publish', publishTask)
runner.load('task:download', downloadTask)
runner.load('task:replay', replayTask)
runner.load('task:list', listTasks)
runner.load('task:describe', describeTask)
runner.load('task:fingerprint', fingerprintTask)
runner.load('task:invoke', invokeTask)

// Runner commands
runner.load('runner:create', createRunner)
runner.load('runner:remove', removeRunner)
runner.load('runner:bundle', bundleRunner)

// Fixture commands
runner.load('fixture:download', downloadFixture)

// Auth commands
runner.load('auth:add', addProfile)
runner.load('auth:switch', switchProfile)
runner.load('auth:list', listProfiles)
runner.load('auth:remove', removeProfile)

// Set handler
runner.setHandler(async (data: ParsedArgs): Promise<unknown> => {
  const parsedArgs = runner.parseArguments(data)
  const { taskName, action, args } = parsedArgs

  console.log('===============================================')
  console.log(`Running: ${taskName} ${action ? action : ''} ${JSON.stringify(args)}`)
  console.log('===============================================')

  let silent = false
  const task = runner.getTask(taskName)
  if (!task) {
    throw new Error(`Task "${taskName}" not found`)
  }

  try {
    let result

    const commandsWithDescriptor = ['task:create', 'task:remove', 'task:publish', 'task:describe', 'task:fingerprint']
    const commandsWithRunner = ['runner:create', 'runner:remove']

    if (commandsWithDescriptor.includes(taskName)) {
      result = await task.run({ descriptorName: action })
    } else if (commandsWithRunner.includes(taskName)) {
      result = await task.run({
        runnerName: action
      })
    } else if (taskName === 'runner:bundle') {
      const paths = args as { targetPath: string }

      result = await task.run({
        runnerName: action,
        targetPath: paths.targetPath
      })
    } else if (taskName === 'task:download') {
      const { uuid } = args as { uuid: string }

      result = await task.run({
        descriptorName: action,
        uuid
      })
    } else if (taskName === 'task:invoke') {
      const { json } = args as { json: string }

      result = await task.run({
        descriptorName: action,
        json
      })
    } else if (taskName === 'task:replay') {
      const { path, cache } = args as { path: string, cache: string }

      result = await task.run({
        descriptorName: action,
        path,
        cache
      })
    } else if (taskName === 'task:run') {
      result = await task.run({
        descriptorName: action,
        args
      })
    } else if (taskName === 'fixture:download') {
      const { uuid } = args as { uuid: string }

      result = await task.run({
        descriptorName: action,
        uuid
      })
      silent = true
    } else if (taskName === 'auth:add') {
      const { apiKey, apiSecret, url } = args as { name: string, apiKey: string, apiSecret: string, url: string }

      result = await task.run({
        name: action,
        apiKey,
        apiSecret,
        url
      })
    } else if (taskName === 'auth:switch' || taskName === 'auth:remove') {
      result = await task.run({
        profileName: action
      })
    } else {
      result = await task.run(args)

      if (taskName === 'info') {
        silent = true
      }
    }

    if (taskName === 'task:describe' || taskName === 'task:list') {
      silent = true
    }

    return {
      silent,
      outcome: 'Success',
      taskName,
      result
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))

    return {
      outcome: 'Failure',
      taskName,
      result: {
        error: err.message,
        stack: err.stack
      }
    }
  } finally {
    setTimeout(() => {
      process.exit(0)
    }, 500)
  }
})

export default runner
