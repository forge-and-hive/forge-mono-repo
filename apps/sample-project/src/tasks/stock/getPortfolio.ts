// TASK: getPortfolio
// Run this task with:
// forge task:run stock:getPortfolio --userUUID="12-3"
// forge task:run stock:getPortfolio --userUUID="45-6"

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

const name = 'stock:getPortfolio'
const description = 'Add task description here'

const schema = new Schema({
  userUUID: Schema.string()
})

const boundaries = {
  getPortfolio: async (userUUID: string): Promise<{ symbol: string, quantity: number, price: number }[]> => {
    if (userUUID !== '12-3' && userUUID !== '45-6') {
      throw new Error('User not found')
    }

    return [
      {
        symbol: 'AAPL',
        quantity: 100,
        price: 150.75
      },
      {
        symbol: 'GOOG',
        quantity: 200,
        price: 2800.22
      },
      {
        symbol: 'MSFT',
        quantity: 300,
        price: 235.77
      }
    ]
  }
}

export const getPortfolio = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function ({ userUUID }, { getPortfolio }) {
    const portfolio = await getPortfolio(userUUID)

    const totalValue = portfolio.reduce((acc: number, stock: { quantity: number, price: number }) => acc + stock.quantity * stock.price, 0)

    return {
      portfolio,
      totalValue
    }
  }
})

