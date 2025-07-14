import { Schema, type SchemaType, type InferSchema, type SchemaDescription } from '@forgehive/schema'
import {
  createBoundary,
  type Mode,
  type Boundaries,
  type WrappedBoundaries,
  type WrappedBoundaryFunction,
  type BoundaryRecord,
  type BoundaryTapeData
} from './utils/boundary'

export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseFunction = (...args: any[]) => any

// Re-export the boundary types for external use
export type {
  BoundaryFunction,
  WrappedBoundaryFunction,
  Boundaries,
  WrappedBoundaries,
  Mode,
  BoundarySuccessRecord,
  BoundaryErrorRecord,
  BoundaryRecord,
  BoundaryTapeData
} from './utils/boundary'

// Re-export Schema for external use
export { Schema }

export interface TaskConfig<B extends Boundaries = Boundaries> {
  name?: string
  description?: string
  schema?: Schema<Record<string, SchemaType>>
  mode?: Mode
  boundaries?: B
  boundariesData?: BoundaryTapeData
}

// Interface for safeReplay configuration
export interface ReplayConfig<B extends Boundaries = Boundaries> {
  boundaries: {
    [K in keyof B]?: Mode
  }
}

// Make BoundaryLog generic
export type BoundaryLog<I extends unknown[] = unknown[], O = unknown> = BoundaryRecord<I, O>;

// Mapped type for boundaries
export type BoundaryLogsFor<B extends Boundaries> = {
  [K in keyof B]: B[K] extends (...args: infer I) => Promise<infer O>
    ? BoundaryLog<I, O>[]
    : BoundaryLog[]
}

/**
 * Represents the execution record of a task, including input, output, error, and boundary data
 */
export interface ExecutionRecord<InputType = unknown, OutputType = unknown, B extends Boundaries = Boundaries> {
  /** The input arguments passed to the task */
  input: InputType
  /** The output returned by the task (if successful) */
  output?: OutputType | null
  /** The error message if the task failed */
  error?: string
  /** Boundary execution data */
  boundaries: BoundaryLogsFor<B>
  /** The name of the task (if set) */
  taskName?: string
  /** Additional context metadata */
  metadata?: Record<string, string>
  /** The type of execution record - computed from output/error state */
  type: 'success' | 'error' | 'pending'
}

export interface TaskInstanceType<Func extends BaseFunction = BaseFunction, B extends Boundaries = Boundaries> {
  version: string

  getName: () => string | undefined
  setName: (name: string) => void
  getMode: () => Mode
  setMode: (mode: Mode) => void
  setSchema: (base: Schema<Record<string, SchemaType>>) => void
  getSchema: () => Schema<Record<string, SchemaType>> | undefined
  setDescription: (description: string) => void
  getDescription: () => string | undefined
  describe: () => SchemaDescription

  // Validation methos
  validate: <T extends Record<string, unknown> = Parameters<Func>[0]>(argv?: T) => ReturnType<Schema<Record<string, SchemaType>>['safeParse']> | undefined
  isValid: <T extends Record<string, unknown> = Parameters<Func>[0]>(argv?: T) => boolean

  // Listener methods
  addListener: <I = Parameters<Func>[0], O = ReturnType<Func>>(fn: (record: ExecutionRecord<I, O, B>) => void) => void
  removeListener: () => void
  emit: (data: ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>) => void

  // Boundary methods
  asBoundary: () => (args: Parameters<Func>[0]) => Promise<ReturnType<Func>>
  getBoundaries: () => WrappedBoundaries<B>
  setBoundariesData: (boundariesData: BoundaryTapeData) => void
  getBondariesData: () => Record<string, unknown>

  // Mocking methods for testing
  mockBoundary: <K extends keyof B>(name: K, mockFn: WrappedBoundaryFunction) => void
  resetMock: <K extends keyof B>(name: K) => void
  resetMocks: () => void

  run: (argv?: Parameters<Func>[0]) => Promise<ReturnType<Func>>
  safeRun: (argv?: Parameters<Func>[0], context?: Record<string, string>) => Promise<[Awaited<ReturnType<Func>> | null, Error | null, ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>]>

  // Method for replaying task execution
  safeReplay: (
    executionLog: ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>,
    config: ReplayConfig<B>
  ) => Promise<[Awaited<ReturnType<Func>> | null, Error | null, ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>]>

  // Handler method for serverless environments
  handler: (event: unknown, context?: unknown) => Promise<{
    statusCode: number
    body: string
  }>
}

// Define a type for the accumulated boundary data
type BoundaryData = Array<{input: unknown[], output?: unknown}>

// Helper type to infer schema type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InferSchemaType<S> = S extends Schema<any> ? InferSchema<S> : Record<string, unknown>;

// Type for execution record boundaries that are automatically injected
// When adding new execution boundaries, add their types here
export type ExecutionRecordBoundaries = {
  setMetadata: (key: string, value: string) => Promise<void>
  // Future execution boundaries can be added here:
  // setContext: (context: Record<string, unknown>) => Promise<void>
  // addTag: (tag: string) => Promise<void>
}

// Helper type for task function with proper typing
export type TaskFunction<S, B extends Boundaries> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (argv: InferSchemaType<S>, boundaries: WrappedBoundaries<B> & ExecutionRecordBoundaries) => Promise<any>;

/**
 * Utility function to compute the execution record type based on output and error state
 */
export function getExecutionRecordType<InputType = unknown, OutputType = unknown, B extends Boundaries = Boundaries>(
  record: Omit<ExecutionRecord<InputType, OutputType, B>, 'type'>
): 'success' | 'error' | 'pending' {
  if (record.error !== undefined && record.error !== null) {
    return 'error'
  }
  if (record.output !== undefined && record.output !== null) {
    return 'success'
  }
  return 'pending'
}

export const Task = class Task<
  B extends Boundaries = Boundaries,
  Func extends BaseFunction = BaseFunction
> implements TaskInstanceType<Func, B> {
  public version: string = '0.1.8'

  // Static property for global listener
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static globalListener?: (record: ExecutionRecord<any, any, any>) => void | Promise<void>

  _fn: Func
  _mode: Mode
  _coolDown: number
  _name?: string
  _description?: string

  _boundariesDefinition: B
  _boundariesData: BoundaryTapeData | null
  _accumulatedBoundariesData: Record<string, BoundaryData> = {}

  // For storing mocks
  _boundaryMocks: Record<string, WrappedBoundaryFunction> = {}

  _schema: Schema<Record<string, SchemaType>> | undefined
  _listener?: ((record: ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>) => void) | undefined

  // Static method to set global listener
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static listenExecutionRecords(listener: (record: ExecutionRecord<any, any, any>) => void | Promise<void>): void {
    this.globalListener = listener
  }

  // Static method to emit to global listener with error handling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async emitExecutionRecord(record: ExecutionRecord<any, any, any>): Promise<void> {
    if (this.globalListener) {
      try {
        // Support both sync and async listeners
        const result = this.globalListener(record)
        if (result instanceof Promise) {
          // Add timeout for async listeners (5 seconds)
          await Promise.race([
            result,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Listener timeout')), 5000)
            )
          ])
        }
      } catch (error) {
        // Log error but don't affect task execution
        // eslint-disable-next-line no-console
        console.error('ExecutionRecord listener error:', error)
      }
    }
  }

  constructor (fn: Func, conf: TaskConfig<B> = {
    name: undefined,
    description: undefined,
    schema: undefined,
    mode: 'proxy',
    boundaries: undefined,
    boundariesData: undefined
  }) {
    this._fn = fn
    this._schema = undefined
    if (typeof conf.schema !== 'undefined') {
      this._schema = conf.schema
    }

    this._mode = conf.mode ?? 'proxy'
    this._boundariesDefinition = conf.boundaries ?? {} as B

    // Set name and description from config
    this._name = conf.name
    this._description = conf.description

    this._listener = undefined

    // Cool down time before killing the process on cli runner
    this._coolDown = 1000

    // Initialize boundaries data
    this._boundariesData = conf.boundariesData ?? null

    // Initialize empty accumulated boundaries data structure
    for (const name in this._boundariesDefinition) {
      this._accumulatedBoundariesData[name] = []
    }

    // Initialize accumulated boundaries data from initial boundaries data
    if (this._boundariesData) {
      // Type assertion to handle initial data safely
      for (const name in this._boundariesData) {
        if (Array.isArray(this._boundariesData[name])) {
          this._accumulatedBoundariesData[name] = this._boundariesData[name] as BoundaryData
        } else {
          this._accumulatedBoundariesData[name] = []
        }
      }
    }
  }

  getName(): string | undefined {
    return this._name
  }

  setName(name: string): void {
    this._name = name
  }

  getMode (): Mode {
    return this._mode
  }

  setMode (mode: Mode): void {
    this._mode = mode
  }

  setSchema (schema: Schema<Record<string, SchemaType>>): void {
    this._schema = schema
  }

  getSchema (): Schema<Record<string, SchemaType>> | undefined {
    return this._schema
  }

  setDescription(description: string): void {
    this._description = description
  }

  getDescription(): string | undefined {
    return this._description
  }

  describe(): SchemaDescription {
    return this._schema?.describe() ?? {}
  }

  validate<T extends Record<string, unknown> = Parameters<Func>[0]>(argv?: T): ReturnType<Schema<Record<string, SchemaType>>['safeParse']> | undefined {
    if (typeof this._schema === 'undefined') {
      return undefined
    }

    const result = this._schema.safeParse(argv)

    return result
  }

  isValid<T extends Record<string, unknown> = Parameters<Func>[0]>(argv?: T): boolean {
    if (typeof this._schema === 'undefined') {
      return true
    }

    const result = this._schema.safeParse(argv)
    return result.success ?? false
  }

  // Posible improvement to handle multiple listeners, but so far its not needed
  addListener<I = Parameters<Func>[0], O = ReturnType<Func>>(fn: (record: ExecutionRecord<I, O, B>) => void): void {
    this._listener = fn as (record: ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>) => void
  }

  removeListener (): void {
    this._listener = undefined
  }

  /*
    The listener get the input/outout of the call
    Plus all the boundary data
  */
  emit (data: ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>): void {
    // Emit to instance listener
    if (typeof this._listener !== 'undefined') {
      this._listener(data)
    }

    // Emit to global listener (non-blocking)
    Task.emitExecutionRecord(data).catch(() => {
      // Error already logged in emitExecutionRecord, just prevent unhandled rejection
    })
  }

  getBoundaries (): WrappedBoundaries<B> {
    // Create fresh boundaries when requested
    return this._createBounderies({
      definition: this._boundariesDefinition,
      baseData: this._boundariesData,
      mode: this._mode
    })
  }

  setBoundariesData (boundariesData: BoundaryTapeData): void {
    this._boundariesData = boundariesData

    // Update accumulated data as well
    // Type assertion to handle provided data safely
    for (const name in boundariesData) {
      if (Array.isArray(boundariesData[name])) {
        this._accumulatedBoundariesData[name] = boundariesData[name] as BoundaryData
      } else {
        this._accumulatedBoundariesData[name] = []
      }
    }
  }

  getBondariesData (): Record<string, unknown> {
    return this._accumulatedBoundariesData
  }

  /**
   * Mocks a specific boundary function for testing
   * @param name The name of the boundary to mock
   * @param mockFn The mock function to use
   */
  mockBoundary<K extends keyof B>(name: K, mockFn: WrappedBoundaryFunction): void {
    this._boundaryMocks[name as string] = mockFn
  }

  /**
   * Resets a specific mocked boundary back to its original function
   * @param name The name of the boundary to reset
   */
  resetMock<K extends keyof B>(name: K): void {
    if (this._boundaryMocks[name as string]) {
      delete this._boundaryMocks[name as string]
    }
  }

  /**
   * Resets all mocked boundaries back to their original functions
   */
  resetMocks(): void {
    this._boundaryMocks = {}
  }

  /**
   * Creates execution record boundaries that modify execution metadata and logging
   * These boundaries are automatically injected into all task executions
   *
   * To add a new execution boundary:
   * 1. Add the boundary function here
   * 2. Update the ExecutionRecordBoundaries type to include the new boundary
   * 3. That's it! The boundary will be available in all tasks automatically
   */
  _createExecutionBoundaries(metadata: Record<string, string>): Record<string, WrappedBoundaryFunction> {
    return {
      // Allows setting metadata key-value pairs from within task execution
      setMetadata: createBoundary(async (...args: unknown[]): Promise<void> => {
        const [key, value] = args as [string, string]
        metadata[key] = value
      })

      // Future execution boundaries can be added here:
      // addMetrics: createBoundary(async (...args: unknown[]): Promise<void> => { ... }),
    }
  }

  _createBounderies ({
    definition,
    baseData,
    mode = 'proxy',
    boundaryModes = {}
  }: {
    definition: B;
    baseData: BoundaryTapeData | null;
    mode?: Mode;
    boundaryModes?: Record<string, Mode | undefined>;
  }): WrappedBoundaries<B> {
    const boundariesFns: Record<string, WrappedBoundaryFunction> = {}

    for (const name in definition) {
      // Get the configured mode for this boundary or use default
      const boundaryMode = boundaryModes[name] || mode

      // Check if we have a mock for this boundary
      if (this._boundaryMocks[name]) {
        boundariesFns[name] = this._boundaryMocks[name]
        continue
      }

      // Create the boundary
      const boundary = createBoundary(definition[name])

      if (baseData !== null && typeof baseData[name] !== 'undefined') {
        const boundaryData = baseData[name] as Array<BoundaryRecord<Parameters<B[Extract<keyof B, string>]>, Awaited<ReturnType<B[Extract<keyof B, string>]>>>>
        boundary.setTape(boundaryData)
      }

      // Set the mode after setting the tape
      boundary.setMode(boundaryMode)

      boundariesFns[name] = boundary
    }

    return boundariesFns as WrappedBoundaries<B>
  }

  asBoundary (): (args: Parameters<Func>[0]) => Promise<ReturnType<Func>> {
    return async (args: Parameters<Func>[0]): Promise<ReturnType<Func>> => {
      return await this.run(args)
    }
  }

  async safeRun (argv?: Parameters<Func>[0]): Promise<[
    Awaited<ReturnType<Func>> | null,
    Error | null,
    ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>
  ]> {
    // Metadata is empty at start. Then will be populated on the task execution
    // Need to implement that task have a ctx and setMetadata({key, value}) boundary
    const metadata = {} as Record<string, string>

    // Initialize log item (without type initially)
    const logItemBase = {
      input: argv as Parameters<Func>[0],
      boundaries: {} as BoundaryLogsFor<B>,
      taskName: this._name,
      metadata: metadata || {}
    }

    // Create the log item with computed type
    const logItem: ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B> = {
      ...logItemBase,
      type: getExecutionRecordType(logItemBase)
    }

    // Create fresh boundaries for this execution
    const executionBoundaries = this._createBounderies({
      definition: this._boundariesDefinition,
      baseData: this._boundariesData,
      mode: this._mode
    })

    // Create and inject execution record boundaries (setMetadata, etc.)
    const executionRecordBoundaries = this._createExecutionBoundaries(metadata)
    const allBoundaries = {
      ...executionBoundaries,
      ...executionRecordBoundaries
    }

    // Start run for each boundary
    for (const name in allBoundaries) {
      const boundary = allBoundaries[name]
      boundary.startRun()
    }

    // Handle schema validation
    if (this._schema) {
      const validation = this._schema.safeParse(argv)
      if (!validation.success) {
        const errorDetails = validation.error?.errors.map(err =>
          `${err.path.join('.')}: ${err.message}`
        ).join(', ')

        const errorMessage = errorDetails
          ? `Invalid input on: ${errorDetails}`
          : 'Invalid input'

        logItem.error = errorMessage
        logItem.type = 'error'
        logItem.boundaries = {} as BoundaryLogsFor<B>

        // Add boundary elements empty
        for (const name in executionBoundaries) {
          logItem.boundaries[name as keyof B] = [] as unknown as BoundaryLogsFor<B>[typeof name]
        }

        this.emit(logItem)
        return [null, new Error(errorMessage), logItem]
      }
    }

    let output: Awaited<ReturnType<Func>> | null = null
    let error: Error | null = null

    try {
      // Execute the task function
      output = await this._fn(
        argv as Parameters<Func>[0],
        allBoundaries as unknown as Parameters<Func>[1]
      )

      logItem.output = output
      logItem.type = 'success'
    } catch (caughtError) {
      const errorMessage = caughtError instanceof Error ? caughtError.message : String(caughtError)
      logItem.error = errorMessage
      logItem.type = 'error'
      error = new Error(errorMessage)
    }

    // Process boundary data after execution (both success and error cases)
    const boundariesRunLog: BoundaryLogsFor<B> = {} as BoundaryLogsFor<B>

    for (const name in executionBoundaries) {
      const boundary = executionBoundaries[name]
      const runData = boundary.getRunData()

      // Add to the run log
      boundariesRunLog[name as keyof B] = runData as unknown as BoundaryLogsFor<B>[typeof name]

      // Accumulate in the task's total boundaries data
      if (!this._accumulatedBoundariesData[name]) {
        this._accumulatedBoundariesData[name] = []
      }

      // Get the current accumulated data for this boundary
      const currentData = this._accumulatedBoundariesData[name]

      // Add the new run data
      if (Array.isArray(runData) && runData.length > 0) {
        // Cast the run data to the correct type
        this._accumulatedBoundariesData[name] = [...currentData, ...(runData as BoundaryData)]
      }
    }

    // Filter out setMetadata boundary calls from the logs (they should not appear in execution record)
    // Note: setMetadata is not part of the original boundaries definition, so it won't be in boundariesRunLog anyway

    // Set boundaries in log item before emitting
    logItem.boundaries = boundariesRunLog

    // Emit the log item
    this.emit(logItem)

    // Return the error, output and log item
    return [output, error, logItem]
  }

  async safeReplay(
    executionLog: ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>,
    config: ReplayConfig<B> = {
      boundaries: {}
    }
  ): Promise<[
    Awaited<ReturnType<Func>> | null,
    Error | null,
    ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>
  ]> {
    // Extract the input from the execution log
    const argv = executionLog.input

    // Initialize log item for this replay (without type initially)
    const logItemBase = {
      input: argv,
      boundaries: {} as BoundaryLogsFor<B>,
      taskName: this._name,
      metadata: executionLog.metadata || {}
    }

    // Create the log item with computed type
    const logItem: ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B> = {
      ...logItemBase,
      type: getExecutionRecordType(logItemBase)
    }

    // Create boundaries for this replay execution with custom modes based on config
    const boundariesConfig: BoundaryTapeData = {}

    // Setup boundary data for replay mode boundaries
    for (const name in this._boundariesDefinition) {
      // Check if this boundary is configured for replay mode
      const mode = config.boundaries[name] || 'proxy'

      if (mode === 'replay' && executionLog.boundaries[name]) {
        // Add boundary data from the execution log for replay mode
        boundariesConfig[name] = executionLog.boundaries[name]
      }
    }

    // Create fresh boundaries for this execution
    const executionBoundaries = this._createBounderies({
      definition: this._boundariesDefinition,
      baseData: boundariesConfig,
      mode: 'proxy',
      boundaryModes: config.boundaries
    })

    // Create and inject execution record boundaries (setMetadata, etc.)
    // Clone the metadata to avoid mutating the original metadata
    const replayMetadata = { ...(logItem.metadata || {}) }
    const executionRecordBoundaries = this._createExecutionBoundaries(replayMetadata)
    const allBoundaries = {
      ...executionBoundaries,
      ...executionRecordBoundaries
    }

    // Start run for each boundary
    for (const name in allBoundaries) {
      const boundary = allBoundaries[name]
      boundary.startRun()
    }

    // Handle schema validation - reusing the input from the execution log
    if (this._schema) {
      const validation = this._schema.safeParse(argv)
      if (!validation.success) {
        const errorDetails = validation.error?.errors.map(err =>
          `${err.path.join('.')}: ${err.message}`
        ).join(', ')

        const errorMessage = errorDetails
          ? `Invalid input on: ${errorDetails}`
          : 'Invalid input'

        logItem.error = errorMessage
        logItem.type = 'error'
        logItem.output = executionLog.output // Keep the original output

        // Copy the boundary data from the execution log
        logItem.boundaries = executionLog.boundaries

        this.emit(logItem)
        return [null, new Error(errorMessage), logItem]
      }
    }

    let output: Awaited<ReturnType<Func>> | null = null
    let error: Error | null = null

    try {
      // Execute the task function with replay boundaries
      output = await this._fn(
        argv,
        allBoundaries as unknown as Parameters<Func>[1]
      )

      logItem.output = output
      logItem.type = 'success'
    } catch (caughtError) {
      const errorMessage = caughtError instanceof Error ? caughtError.message : String(caughtError)
      logItem.error = errorMessage
      logItem.type = 'error'
      error = new Error(errorMessage)
    }

    // Process boundary data after execution
    const boundariesRunLog: BoundaryLogsFor<B> = {} as BoundaryLogsFor<B>

    for (const name in executionBoundaries) {
      const boundary = executionBoundaries[name]
      const runData = boundary.getRunData()

      // For boundaries in replay mode, use the original log data instead
      const mode = config.boundaries[name] || 'proxy'
      if (mode === 'replay' && executionLog.boundaries[name]) {
        boundariesRunLog[name as keyof B] = executionLog.boundaries[name as keyof B]
      } else {
        // For other modes, use the actual run data
        boundariesRunLog[name as keyof B] = runData as unknown as BoundaryLogsFor<B>[typeof name]
      }
    }

    // Filter out setMetadata boundary calls from the logs (they should not appear in execution record)
    // Note: setMetadata is not part of the original boundaries definition, so it won't be in boundariesRunLog anyway

    // Set boundaries in log item before emitting
    logItem.boundaries = boundariesRunLog

    // Update the log item metadata with changes made during replay
    logItem.metadata = replayMetadata

    // Emit the log item
    this.emit(logItem)

    // Return the output, error, and log item
    return [output, error, logItem]
  }

  async run (argv?: Parameters<Func>[0]): Promise<ReturnType<Func>> {
    const [result, error] = await this.safeRun(argv)

    if (error) {
      throw error
    }

    return result as ReturnType<Func>
  }

  handler = async (event: unknown, _context?: unknown): Promise<{
    statusCode: number
    body: string
  }> => {
    const eventArgs = (event && typeof event === 'object' && 'args' in event) ? (event).args : {}

    // Check validation first
    if (this._schema) {
      const validation = this._schema.safeParse(eventArgs)
      if (!validation.success) {
        const errorDetails = validation.error?.errors.map(err =>
          `${err.path.join('.')}: ${err.message}`
        ).join(', ')

        const errorMessage = errorDetails
          ? `Invalid input on: ${errorDetails}`
          : 'Invalid input'

        return {
          statusCode: 422,
          body: JSON.stringify({
            error: errorMessage,
            details: validation.error?.errors
          })
        }
      }
    }

    try {
      // Call the task's safeRun method
      const [outcome, error, log] = await this.safeRun(eventArgs)

      // Extend log metadata with environment info
      log.metadata = {
        ...log.metadata,
        environment: 'hive-lambda'
      }

      // Send log to Hive if environment variables are present
      await this._sendToHive(log)

      if (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: error.message,
            stack: error.stack
          })
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify(outcome)
      }
    } catch (e: unknown) {
      const error = e as Error

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
      }
    }
  }

  async _sendToHive(log: ExecutionRecord<Parameters<Func>[0], ReturnType<Func>, B>): Promise<void> {
    const apiKey = process.env.HIVE_API_KEY
    const apiSecret = process.env.HIVE_API_SECRET
    const host = process.env.HIVE_HOST
    const projectName = process.env.HIVE_PROJECT_NAME


    // If any required env vars are missing, do nothing
    if (!apiKey || !apiSecret || !host || !projectName) {
      // eslint-disable-next-line no-console
      console.log('Missing required env vars for sending log to Hive:', { apiKey, apiSecret, host, projectName })
      return
    }

    // eslint-disable-next-line no-console
    console.log('Sending log to Hive:', log)

    return new Promise<void>((resolve) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const https = require('https')
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const http = require('http')
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const url = require('url')

        const logsUrl = `${host}/api/tasks/log-ingest`
        // eslint-disable-next-line no-console
        console.log('logsUrl', logsUrl)
        const parsedUrl = url.parse(logsUrl)
        const authToken = `${apiKey}:${apiSecret}`

        const postData = JSON.stringify({
          projectName,
          taskName: process.env.HIVE_TASK_NAME || this._fn.name || 'unnamed-task',
          logItem: JSON.stringify(log)
        })

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.path,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }

        const client = parsedUrl.protocol === 'https:' ? https : http

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = client.request(options, (res: any) => {
          // eslint-disable-next-line no-console
          console.log('Hive API response status:', res.statusCode)
          // eslint-disable-next-line no-console
          console.log('Hive API response headers:', res.headers)

          let responseData = ''

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.on('data', (chunk: any) => {
            responseData += chunk
          })

          res.on('end', () => {
            // eslint-disable-next-line no-console
            console.log('Hive API response body:', responseData)
            if (res.statusCode >= 200 && res.statusCode < 300) {
              // eslint-disable-next-line no-console
              console.log('Successfully sent log to Hive')
            } else {
              // eslint-disable-next-line no-console
              console.error('Hive API error - Status:', res.statusCode, 'Body:', responseData)
            }
            resolve() // Resolve the promise when request completes
          })
        })

        req.on('error', (error: Error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to send log to Hive - Request error:', error.message)
          resolve() // Resolve even on error to not block the handler
        })

        req.write(postData)
        req.end()
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to send log to Hive:', error instanceof Error ? error.message : 'Unknown error')
        resolve() // Resolve even on error to not block the handler
      }
    })
  }
}

/**
 * Configuration object for creating a task
 */
export interface CreateTaskConfig<
  S extends Schema<Record<string, SchemaType>>,
  B extends Boundaries,
  R
> {
  name?: string
  description?: string
  schema: S
  boundaries: B
  fn: (argv: InferSchemaType<S>, boundaries: WrappedBoundaries<B> & ExecutionRecordBoundaries) => Promise<R>
  mode?: Mode
  boundariesData?: BoundaryTapeData
}

/**
 * Helper function to create a task with proper type inference
 * @param config Configuration object containing schema, boundaries, and function
 * @returns A new Task instance with proper type inference
 */
export function createTask<
  S extends Schema<Record<string, SchemaType>>,
  B extends Boundaries,
  R
>(
  config: CreateTaskConfig<S, B, R>
): TaskInstanceType<(argv: InferSchemaType<S>, boundaries: WrappedBoundaries<B>) => Promise<R>, B> {
  const task = new Task(
    config.fn,
    {
      name: config.name,
      description: config.description,
      schema: config.schema,
      boundaries: config.boundaries,
      mode: config.mode,
      boundariesData: config.boundariesData
    }
  )
  return task
}
