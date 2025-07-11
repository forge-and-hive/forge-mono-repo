import { Runner } from '../index'
import { Schema, createTask } from '@forgehive/task'

describe('Runner describe', () => {
  it('should return task details including name, description and schema', () => {
    const runner = new Runner()
    const schema = new Schema({
      value: Schema.number()
    })

    const task = createTask({
      schema,
      boundaries: {},
      fn: async ({ value }) => {
        return value
      }
    })

    task.setDescription('A test task that processes numbers')

    runner.load('testTask', task)
    const result = runner.describe()

    expect(result).toEqual({
      testTask: {
        name: 'testTask',
        description: 'A test task that processes numbers',
        schema: {
          value: {
            type: 'number'
          }
        }
      }
    })
  })

  it('should handle tasks without description or schema', () => {
    const runner = new Runner()
    const schema = new Schema({})

    const task = createTask({
      schema,
      boundaries: {},
      fn: async () => {
        return 'test'
      }
    })

    runner.load('simpleTask', task)
    const result = runner.describe()

    expect(result).toEqual({
      simpleTask: {
        name: 'simpleTask',
        description: undefined,
        schema: {}
      }
    })
  })

  it('should handle multiple tasks with task: prefix', () => {
    const runner = new Runner()

    const schema = new Schema({
      descriptorName: Schema.string(),
      args: Schema.mixedRecord()
    })

    const runTask = createTask({
      schema,
      boundaries: {},
      fn: async () => 'running'
    })

    runTask.setDescription('Executes the task')

    const createTaskInstance = createTask({
      schema: new Schema({
        descriptorName: Schema.string()
      }),
      boundaries: {},
      fn: async ({ descriptorName }) => {
        return descriptorName
      }
    })

    createTaskInstance.setDescription('Creates a new task')

    runner.load('task:run', runTask)
    runner.load('task:create', createTaskInstance)

    const result = runner.describe()

    expect(result).toEqual({
      'task:run': {
        name: 'task:run',
        description: 'Executes the task',
        schema: {
          descriptorName: {
            type: 'string'
          },
          args: {
            type: 'mixedRecord'
          }
        }
      },
      'task:create': {
        name: 'task:create',
        description: 'Creates a new task',
        schema: {
          descriptorName: {
            type: 'string'
          }
        }
      }
    })
  })
})
