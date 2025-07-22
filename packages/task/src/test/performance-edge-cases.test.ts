/* eslint-disable no-console */
import { createTask, TimingTracker, validateMetric, createMetric } from '../index'
import { Schema } from '@forgehive/schema'

describe.skip('Performance and Edge Case Tests', () => {
  describe('Performance impact of timing and metrics collection', () => {
    it('should have minimal performance overhead for timing collection', async () => {
      const baselineTask = createTask({
        name: 'baseline-performance',
        schema: new Schema({ iterations: Schema.number() }),
        boundaries: {
          simpleOperation: async (value: number) => {
            return value * 2
          }
        },
        fn: async ({ iterations }, { simpleOperation }) => {
          const results = []
          for (let i = 0; i < iterations; i++) {
            results.push(await simpleOperation(i))
          }
          return { results }
        }
      })

      const timingTask = createTask({
        name: 'timing-performance',
        schema: new Schema({ iterations: Schema.number() }),
        boundaries: {
          simpleOperation: async (value: number) => {
            return value * 2
          }
        },
        fn: async ({ iterations }, { simpleOperation, setMetrics }) => {
          const results = []
          for (let i = 0; i < iterations; i++) {
            results.push(await simpleOperation(i))
            // Add timing metrics for each operation
            await setMetrics({ type: 'performance', name: 'operation_completed', value: i })
          }
          return { results }
        }
      })

      const iterations = 100

      // Measure baseline performance (without extensive metrics)
      const baselineStart = Date.now()
      const [baselineResult, baselineError, baselineRecord] = await baselineTask.safeRun({ iterations })
      const baselineTime = Date.now() - baselineStart

      expect(baselineError).toBeNull()
      expect(baselineResult?.results).toHaveLength(iterations)

      // Measure performance with timing and metrics
      const timingStart = Date.now()
      const [timingResult, timingError, timingRecord] = await timingTask.safeRun({ iterations })
      const timingTime = Date.now() - timingStart

      expect(timingError).toBeNull()
      expect(timingResult?.results).toHaveLength(iterations)
      expect(timingRecord.metrics).toHaveLength(iterations)

      // Performance overhead should be reasonable (less than 50% increase)
      const overhead = (timingTime - baselineTime) / baselineTime
      expect(overhead).toBeLessThan(0.5) // Less than 50% overhead

      // Verify timing accuracy - duration should be 0 or greater for fast operations
      expect(baselineRecord.timing?.duration).toBeGreaterThanOrEqual(0)
      expect(timingRecord.timing?.duration).toBeGreaterThanOrEqual(0)

      console.log('Performance Test Results:')
      console.log(`Baseline: ${baselineTime}ms, With timing: ${timingTime}ms`)
      console.log(`Overhead: ${(overhead * 100).toFixed(1)}%`)
    })

    it('should handle high-frequency timing operations efficiently', () => {
      const timings: Array<{ startTime: number; endTime: number; duration?: number }> = []
      const iterations = 1000

      const start = Date.now()

      for (let i = 0; i < iterations; i++) {
        const tracker = TimingTracker.create()
        tracker.start()

        // Simulate very brief operation
        for (let j = 0; j < 10; j++) {
          Math.random()
        }

        const timing = tracker.end()
        if (timing) {
          timings.push(timing)
        }
      }

      const totalTime = Date.now() - start

      // Verify all timings were captured
      expect(timings).toHaveLength(iterations)
      timings.forEach(timing => {
        expect(timing).not.toBeNull()
        expect(timing.duration).toBeGreaterThanOrEqual(0)
      })

      // High-frequency timing should complete reasonably quickly
      expect(totalTime).toBeLessThan(1000) // Less than 1 second for 1000 operations

      console.log(`High-frequency timing: ${iterations} operations in ${totalTime}ms`)
    })

    it('should handle large metrics collections without memory issues', async () => {
      const largeMetricsTask = createTask({
        name: 'large-metrics-test',
        schema: new Schema({ metricCount: Schema.number() }),
        boundaries: {},
        fn: async ({ metricCount }, { setMetrics }) => {
          for (let i = 0; i < metricCount; i++) {
            await setMetrics({
              type: i % 3 === 0 ? 'business' : i % 3 === 1 ? 'performance' : 'error',
              name: `metric_${i}`,
              value: Math.random() * 1000
            })
          }
          return { metricsCreated: metricCount }
        }
      })

      const metricCount = 1000
      const memoryBefore = process.memoryUsage()

      const [result, error, record] = await largeMetricsTask.safeRun({ metricCount })

      const memoryAfter = process.memoryUsage()

      expect(error).toBeNull()
      expect(result?.metricsCreated).toBe(metricCount)
      expect(record.metrics).toHaveLength(metricCount)

      // Verify metrics are correctly structured
      record.metrics?.forEach((metric, index) => {
        expect(metric).toEqual(expect.objectContaining({
          type: expect.stringMatching(/^(business|performance|error)$/),
          name: `metric_${index}`,
          value: expect.any(Number)
        }))
      })

      // Memory usage should not explode
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB increase

      console.log(`Large metrics test: ${metricCount} metrics, memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle missing timing data gracefully', async () => {
      // Manually create a broken timing scenario
      const tracker = TimingTracker.create()
      // Don't call start()
      const timing = tracker.end()

      expect(timing).toBeNull()

      // Test with multiple end calls
      tracker.start()
      const timing1 = tracker.end()
      const timing2 = tracker.end() // Second end call

      expect(timing1).not.toBeNull()
      expect(timing2).toBeNull() // Should return null on second call
    })

    it('should handle invalid metrics gracefully', () => {
      // Test boundary conditions for metric validation
      expect(validateMetric({ type: 'business', name: 'test', value: 0 })).toBe(true)
      expect(validateMetric({ type: 'business', name: 'test', value: -1 })).toBe(true)
      expect(validateMetric({ type: 'business', name: 'test', value: 999999 })).toBe(true)

      // Test invalid cases
      expect(validateMetric({ type: 'business', name: 'test', value: null })).toBe(false)
      expect(validateMetric({ type: 'business', name: 'test', value: undefined })).toBe(false)
      expect(validateMetric({ type: 'business', name: 'test', value: 'string' })).toBe(false)
      expect(validateMetric({ type: 'business', name: 'test', value: {} })).toBe(false)
      expect(validateMetric({ type: 'business', name: 'test', value: [] })).toBe(false)

      // Test edge cases with createMetric
      expect(() => createMetric('business', 'test', 0)).not.toThrow()
      expect(() => createMetric('business', 'test', -999)).not.toThrow()
      expect(() => createMetric('business', 'test', 0.0001)).not.toThrow()

      expect(() => createMetric('', 'test', 1)).toThrow()
      expect(() => createMetric('business', '', 1)).toThrow()
      expect(() => createMetric('business', 'test', NaN)).toThrow()
      expect(() => createMetric('business', 'test', Infinity)).toThrow()
      expect(() => createMetric('business', 'test', -Infinity)).toThrow()
    })

    it('should handle memory cleanup and long-running tasks', async () => {
      const longRunningTask = createTask({
        name: 'memory-cleanup-test',
        schema: new Schema({ duration: Schema.number() }),
        boundaries: {
          memoryIntensiveOperation: async (iterations: number) => {
            const data = []
            for (let i = 0; i < iterations; i++) {
              data.push(new Array(1000).fill(Math.random()))
            }
            return { processed: data.length, size: data.length * 1000 }
          }
        },
        fn: async ({ duration }, { memoryIntensiveOperation, setMetrics }) => {
          const startTime = Date.now()
          const results = []

          while (Date.now() - startTime < duration) {
            const result = await memoryIntensiveOperation(100)
            results.push(result)

            await setMetrics({ type: 'performance', name: 'memory_operations', value: 1 })
            await setMetrics({ type: 'business', name: 'data_processed', value: result.processed })

            // Force garbage collection opportunity
            if (results.length % 10 === 0) {
              if (global.gc) {
                global.gc()
              }
            }
          }

          return { operations: results.length, totalProcessed: results.reduce((sum, r) => sum + r.processed, 0) }
        }
      })

      const memoryBefore = process.memoryUsage()

      const [result, error, record] = await longRunningTask.safeRun({ duration: 500 }) // 500ms

      // Allow some time for garbage collection
      await new Promise(resolve => setTimeout(resolve, 100))
      if (global.gc) {
        global.gc()
      }

      const memoryAfter = process.memoryUsage()

      expect(error).toBeNull()
      expect(result?.operations).toBeGreaterThan(0)
      expect(record.metrics?.length).toBeGreaterThan(0)

      // Memory should not grow excessively
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Less than 100MB

      console.log(`Memory cleanup test: ${result?.operations} operations, memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`)
    })

    it('should handle concurrent task executions without interference', async () => {
      const concurrentTask = createTask({
        name: 'concurrent-test',
        schema: new Schema({ taskId: Schema.string(), delay: Schema.number() }),
        boundaries: {
          processWithDelay: async (taskId: string, delay: number) => {
            await new Promise(resolve => setTimeout(resolve, delay))
            return { taskId, processedAt: Date.now() }
          }
        },
        fn: async ({ taskId, delay }, { processWithDelay, setMetrics, setMetadata }) => {
          await setMetadata('taskId', taskId)
          await setMetadata('concurrencyTest', 'true')

          await setMetrics({ type: 'business', name: 'concurrent_tasks', value: 1 })

          const result = await processWithDelay(taskId, delay)

          await setMetrics({ type: 'performance', name: 'task_delay', value: delay })
          await setMetrics({ type: 'business', name: 'tasks_completed', value: 1 })

          return { taskId, result, delay }
        }
      })

      // Launch multiple concurrent tasks
      const tasks = [
        concurrentTask.safeRun({ taskId: 'task-1', delay: 100 }),
        concurrentTask.safeRun({ taskId: 'task-2', delay: 150 }),
        concurrentTask.safeRun({ taskId: 'task-3', delay: 80 }),
        concurrentTask.safeRun({ taskId: 'task-4', delay: 200 }),
        concurrentTask.safeRun({ taskId: 'task-5', delay: 120 })
      ]

      const results = await Promise.all(tasks)

      // Verify all tasks completed successfully
      results.forEach(([result, error, record], index) => {
        expect(error).toBeNull()
        expect(result?.taskId).toBe(`task-${index + 1}`)
        expect(record.metrics).toHaveLength(3)
        expect(record.timing).toBeDefined()
        expect(record.boundaries.processWithDelay).toHaveLength(1)
      })

      // Verify timing isolation between concurrent tasks
      const timings = results.map(([,, record]) => record.timing!)
      timings.forEach((timing, index) => {
        expect(timing.duration).toBeGreaterThanOrEqual([100, 150, 80, 200, 120][index] - 20)
        expect(timing.duration).toBeLessThan([100, 150, 80, 200, 120][index] + 50)
      })

      console.log(`Concurrent tasks completed: ${results.length}`)
    })

    it('should handle extreme boundary call counts', async () => {
      const extremeBoundaryTask = createTask({
        name: 'extreme-boundary-test',
        schema: new Schema({ callCount: Schema.number() }),
        boundaries: {
          lightweightOperation: async (index: number) => {
            return { index, doubled: index * 2 }
          }
        },
        fn: async ({ callCount }, { lightweightOperation, setMetrics }) => {
          await setMetrics({ type: 'business', name: 'boundary_test_runs', value: 1 })

          const results = []
          for (let i = 0; i < callCount; i++) {
            const result = await lightweightOperation(i)
            results.push(result)

            // Add metrics every 100 calls to avoid excessive metrics
            if (i % 100 === 0) {
              await setMetrics({ type: 'performance', name: 'batch_progress', value: i })
            }
          }

          await setMetrics({ type: 'business', name: 'total_boundary_calls', value: callCount })
          return { results: results.length, lastResult: results[results.length - 1] }
        }
      })

      const callCount = 1000
      const start = Date.now()

      const [result, error, record] = await extremeBoundaryTask.safeRun({ callCount })

      const executionTime = Date.now() - start

      expect(error).toBeNull()
      expect(result?.results).toBe(callCount)
      expect(record.boundaries.lightweightOperation).toHaveLength(callCount)

      // Verify all boundary calls have timing
      record.boundaries.lightweightOperation.forEach((call, index) => {
        expect(call.timing).toBeDefined()
        expect(call.input).toEqual([index])
        expect(call.output).toEqual({ index, doubled: index * 2 })
      })

      // Performance should be reasonable for high volume
      expect(executionTime).toBeLessThan(5000) // Less than 5 seconds for 1000 calls

      console.log(`Extreme boundary test: ${callCount} calls in ${executionTime}ms`)
    })

    it('should handle schema validation edge cases with timing', async () => {
      const validationTask = createTask({
        name: 'validation-edge-case-test',
        schema: new Schema({
          requiredString: Schema.string(),
          optionalNumber: Schema.number().optional(),
          nestedValue: Schema.number()
        }),
        boundaries: {},
        fn: async ({ requiredString, optionalNumber, nestedValue }) => {
          return {
            processed: true,
            stringLength: requiredString.length,
            hasOptional: optionalNumber !== undefined,
            nestedValue: nestedValue
          }
        }
      })

      // Test with valid input
      const [validResult, validError, validRecord] = await validationTask.safeRun({
        requiredString: 'test',
        optionalNumber: 42,
        nestedValue: 100
      })

      expect(validError).toBeNull()
      expect(validResult?.processed).toBe(true)
      expect(validRecord.timing).toBeDefined()
      expect(validRecord.type).toBe('success')

      // Test with invalid input (should fail validation before timing main function)
      const [invalidResult, invalidError, invalidRecord] = await validationTask.safeRun({
        requiredString: 123, // Wrong type
        nestedValue: 'not-a-number' // Wrong type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      expect(invalidResult).toBeNull()
      expect(invalidError).not.toBeNull()
      expect(invalidRecord.type).toBe('error')
      expect(invalidRecord.timing).toBeUndefined() // No main function timing on validation error

      // Test with missing required field
      const [missingResult, missingError, missingRecord] = await validationTask.safeRun({
        nestedValue: 100
        // Missing requiredString
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      expect(missingResult).toBeNull()
      expect(missingError).not.toBeNull()
      expect(missingRecord.type).toBe('error')
      expect(missingRecord.timing).toBeUndefined()

      console.log(`Schema validation edge cases: valid=${validRecord.type}, invalid=${invalidRecord.type}, missing=${missingRecord.type}`)
    })

    it('should handle very large execution records efficiently', async () => {
      const largeRecordTask = createTask({
        name: 'large-record-test',
        schema: new Schema({
          dataSize: Schema.number(),
          metricCount: Schema.number()
        }),
        boundaries: {
          generateLargeData: async (size: number) => {
            const data = []
            for (let i = 0; i < size; i++) {
              data.push({
                id: `item_${i}`,
                data: new Array(100).fill(Math.random()),
                metadata: { index: i, category: `cat_${i % 10}` }
              })
            }
            return { items: data, totalSize: size }
          },
          processLargeDataset: async (dataset: { items: Array<{ id: string; data: number[] }> }) => {
            // Simulate heavy processing
            const processed = dataset.items.map((item: { id: string; data: number[] }) => ({
              id: item.id,
              processed: true,
              checksum: item.data.reduce((sum: number, val: number) => sum + val, 0)
            }))
            return { processed, count: processed.length }
          }
        },
        fn: async ({ dataSize, metricCount }, { generateLargeData, processLargeDataset, setMetrics, setMetadata }) => {
          await setMetadata('dataSize', dataSize.toString())
          await setMetadata('expectedMetrics', metricCount.toString())

          // Generate large dataset
          const dataset = await generateLargeData(dataSize)
          await setMetrics({ type: 'business', name: 'data_generated', value: dataset.totalSize })

          // Generate many metrics
          for (let i = 0; i < metricCount; i++) {
            await setMetrics({
              type: i % 3 === 0 ? 'business' : i % 3 === 1 ? 'performance' : 'error',
              name: `large_record_metric_${i}`,
              value: Math.random() * 1000
            })
          }

          // Process the large dataset
          const result = await processLargeDataset(dataset)
          await setMetrics({ type: 'business', name: 'items_processed', value: result.count })

          return {
            dataSize: dataset.totalSize,
            processedCount: result.count,
            metricsGenerated: metricCount,
            status: 'completed'
          }
        }
      })

      const memoryBefore = process.memoryUsage()
      const start = Date.now()

      const [result, error, record] = await largeRecordTask.safeRun({
        dataSize: 100, // 100 items with 100 random numbers each
        metricCount: 200 // 200 metrics
      })

      const executionTime = Date.now() - start
      const memoryAfter = process.memoryUsage()

      expect(error).toBeNull()
      expect(result?.status).toBe('completed')
      expect(result?.dataSize).toBe(100)
      expect(result?.metricsGenerated).toBe(200)

      // Verify record structure
      expect(record.metrics).toHaveLength(202) // 200 + 2 additional metrics
      expect(record.boundaries.generateLargeData).toHaveLength(1)
      expect(record.boundaries.processLargeDataset).toHaveLength(1)

      // Verify large data in boundaries is preserved
      const generatedData = record.boundaries.generateLargeData[0].output
      if (generatedData) {
        expect(generatedData.items).toHaveLength(100)
        expect(generatedData.items[0].data).toHaveLength(100)
      }

      // Performance should be reasonable even with large records
      expect(executionTime).toBeLessThan(2000) // Less than 2 seconds

      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Less than 100MB

      console.log(`Large record test: ${result?.dataSize} items, ${result?.metricsGenerated} metrics, ${executionTime}ms, ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`)
    })
  })

  describe('Timing accuracy and precision tests', () => {
    it('should maintain timing accuracy across different execution patterns', async () => {
      const precisionTask = createTask({
        name: 'timing-precision-test',
        schema: new Schema({ pattern: Schema.string() }),
        boundaries: {
          fixedDelay: async (ms: number) => {
            await new Promise(resolve => setTimeout(resolve, ms))
            return { delayed: ms }
          },
          variableDelay: async (baseMs: number) => {
            const actualDelay = baseMs + Math.random() * 20 - 10 // ±10ms variation
            await new Promise(resolve => setTimeout(resolve, actualDelay))
            return { delayed: actualDelay }
          }
        },
        fn: async ({ pattern }, { fixedDelay, variableDelay, setMetrics }) => {
          const timings = []

          if (pattern === 'fixed') {
            // Test fixed delays
            const delays = [50, 100, 150]
            for (const delay of delays) {
              const start = Date.now()
              await fixedDelay(delay)
              const measured = Date.now() - start
              timings.push({ expected: delay, measured })
              await setMetrics({ type: 'performance', name: 'timing_accuracy', value: Math.abs(measured - delay) })
            }
          } else if (pattern === 'variable') {
            // Test variable delays
            for (let i = 0; i < 5; i++) {
              const baseDelay = 80
              const start = Date.now()
              const result = await variableDelay(baseDelay)
              const measured = Date.now() - start
              timings.push({ expected: result.delayed, measured })
            }
          }

          return { pattern, timings }
        }
      })

      // Test fixed timing precision
      const [fixedResult, fixedError, fixedRecord] = await precisionTask.safeRun({ pattern: 'fixed' })

      expect(fixedError).toBeNull()
      expect(fixedResult?.timings).toHaveLength(3)

      // Verify boundary timing accuracy
      fixedRecord.boundaries.fixedDelay.forEach((call, index) => {
        const expectedDelay = [50, 100, 150][index]
        const actualDuration = call.timing.duration
        const accuracy = Math.abs(actualDuration! - expectedDelay)

        // Timing should be within 30ms of expected (allowing for system variance)
        expect(accuracy).toBeLessThan(30)
      })

      // Test variable timing
      const [variableResult, variableError, variableRecord] = await precisionTask.safeRun({ pattern: 'variable' })

      expect(variableError).toBeNull()
      expect(variableResult?.timings).toHaveLength(5)

      // Verify variable timing boundaries
      variableRecord.boundaries.variableDelay.forEach((call) => {
        expect(call.timing.duration).toBeGreaterThan(60) // Should be at least 70ms (80-10)
        expect(call.timing.duration).toBeLessThan(120) // Should be at most 110ms (80+10+20 for variance)
      })

      console.log(`Timing precision test completed: fixed=${fixedRecord.boundaries.fixedDelay.length} calls, variable=${variableRecord.boundaries.variableDelay.length} calls`)
    })
  })
})
