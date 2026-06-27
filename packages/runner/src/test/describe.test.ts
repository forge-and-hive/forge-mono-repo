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

    // schema is now serialized as JSON Schema (draft 2020-12)
    expect(result.testTask.name).toBe('testTask')
    expect(result.testTask.description).toBe('A test task that processes numbers')
    expect(result.testTask.schema).toMatchObject({
      type: 'object',
      properties: { value: { type: 'number' } },
      required: ['value']
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

    expect(result.simpleTask.name).toBe('simpleTask')
    expect(result.simpleTask.description).toBeUndefined()
    // empty schema -> JSON Schema object with no properties
    expect(result.simpleTask.schema).toMatchObject({
      type: 'object',
      properties: {}
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

    expect(result['task:run'].name).toBe('task:run')
    expect(result['task:run'].description).toBe('Executes the task')
    expect(result['task:run'].schema).toMatchObject({
      type: 'object',
      properties: {
        descriptorName: { type: 'string' },
        args: {
          type: 'object',
          additionalProperties: {
            anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }]
          }
        }
      },
      required: ['descriptorName', 'args']
    })

    expect(result['task:create'].name).toBe('task:create')
    expect(result['task:create'].description).toBe('Creates a new task')
    expect(result['task:create'].schema).toMatchObject({
      type: 'object',
      properties: {
        descriptorName: { type: 'string' }
      },
      required: ['descriptorName']
    })
  })
})
