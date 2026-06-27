// TASK: getPrice
// Run this task with:
// forge task:run stock:getPrice --ticker AAPL
// forge task:run stock:getPrice --ticker VOO

import { createTask } from '@forgehive/task'
import { Schema } from '@forgehive/schema'

const schema = new Schema({
  ticker: Schema.string().describe('Stock ticker symbol, e.g. AAPL')
})

const name = 'stock:getPrice'
const description = 'Get the price of a stock'

const boundaries = {
  fetchStockPrice: async (ticker: string): Promise<{price:number}> => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch stock price for ${ticker}: ${response.statusText}`)
    }

    const data = await response.json()
    const price = data.chart.result[0].meta.regularMarketPrice
    return {price}
  }
}

export const getPrice = createTask({
  name,
  description,
  schema,
  boundaries,
  fn: async function ({ ticker }, { fetchStockPrice, setMetadata, setMetrics }): Promise<{ ticker: string, price: number }> {
    const { price } = await fetchStockPrice(ticker as string)

    setMetadata('environment', 'sample-script')
    setMetadata('ticker', ticker)
    setMetrics({ type: 'stock', name: 'price', value: price })

    return {
      ticker,
      price
    }
  }
})
