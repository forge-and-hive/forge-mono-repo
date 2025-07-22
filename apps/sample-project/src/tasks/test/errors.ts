// TASK: errors
// Run this task with:
// forge task:run test:errors --userId=1 (will work)
// forge task:run test:errors --userId=2 (will work)
// forge task:run test:errors --userId=3 (will fail - user not found)
// forge task:run test:errors --userId=4 (will fail - API error)

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

const name = 'test:errors'
const description = 'Test task with intentional runtime errors for error collection testing'

const schema = new Schema({
  userId: Schema.string()
})

interface User {
  id: string
  name: string
  email: string
}

const boundaries = {
  // This boundary returns user for IDs 1 and 2, null for others
  getUserById: async (input: { userId: string }): Promise<User | null> => {
    if (input.userId === '1') {
      return { id: '1', name: 'John Doe', email: 'john@example.com' }
    }
    if (input.userId === '2') {
      return { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
    }
    return null // User not found
  },

  // This boundary simulates an API call that randomly throws errors
  fetchUserProfile: async (input: { userId: string }): Promise<{ profile: string; lastLogin: string }> => {
    // Simulate random API failures
    if (Math.random() > 0.7) {
      throw new Error('API temporarily unavailable')
    }

    if (input.userId === '4') {
      throw new Error('External API authentication failed')
    }

    return {
      profile: `Profile data for user ${input.userId}`,
      lastLogin: new Date().toISOString()
    }
  }
}

export const errors = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function ({ userId }, { getUserById, fetchUserProfile }) {
    // Get user by ID
    const user = await getUserById({ userId })

    // Check if user exists - this should be caught as a business logic error
    if (!user) {
      throw new Error(`User with ID ${userId} not found`)
    }

    // Fetch additional profile data - this can throw API errors (no try-catch intentionally)
    const profile = await fetchUserProfile({ userId })

    // Return combined user data
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      profile: profile.profile,
      lastLogin: profile.lastLogin,
      processed: true
    }
  }
})

