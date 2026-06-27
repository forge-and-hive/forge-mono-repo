// TASK: sample
// Run this task with:
// forge task:run test:sample

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

const name = 'test:sample'
const description = 'Add task description here'

const schema = new Schema({
  // Add your schema definitions here.
  // Use .describe() so the field shows up in `forge test:sample --help`.
  // example: myParam: Schema.string().describe('What this parameter is for')
})

const boundaries = {
  // Add your boundary functions here
  // example: readFile: async (path: string) => fs.readFile(path, 'utf-8')
}

export const sample = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function (argv, boundaries) {
    // eslint-disable-next-line no-console
    console.log('input:', argv)
    // eslint-disable-next-line no-console
    console.log('boundaries:', Object.keys(boundaries))
    // Your task implementation goes here

    return {}
  }
})

