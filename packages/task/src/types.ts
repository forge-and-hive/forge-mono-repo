/**
 * Shared types for execution timing and metrics
 */

/**
 * Timing information for tracking start/end times and duration
 */
export interface TimingInfo {
  /** Unix timestamp in milliseconds when execution started */
  startTime: number;
  /** Unix timestamp in milliseconds when execution ended */
  endTime: number;
  /** Computed duration in milliseconds (endTime - startTime) */
  duration?: number;
}

/**
 * Metric data structure for collecting custom measurements
 */
export interface Metric {
  /** Category of metric (e.g., "performance", "business", "error") */
  type: string;
  /** Specific metric name (e.g., "response_time", "items_processed") */
  name: string;
  /** Numeric value of the metric */
  value: number;
}

/**
 * Utility class for capturing timing information
 */
export class TimingTracker {
  private startTime: number | null = null

  /**
   * Start timing capture
   */
  start(): void {
    this.startTime = Date.now()
  }

  /**
   * End timing capture and return timing information
   * @returns TimingInfo object or null if start() was not called
   */
  end(): TimingInfo | null {
    if (this.startTime === null) {return null}

    const endTime = Date.now()
    return {
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime
    }
  }

  /**
   * Create a new TimingTracker instance
   * @returns New TimingTracker instance
   */
  static create(): TimingTracker {
    return new TimingTracker()
  }
}

/**
 * Enhanced boundary record with timing information
 */
export interface BoundaryTimingRecord<TInput = unknown[], TOutput = unknown> {
  input: TInput;
  output?: TOutput;
  error?: string;
  timing: TimingInfo;
}

/**
 * Base execution record interface with timing and metrics support
 */
export interface BaseExecutionRecord<InputType = unknown, OutputType = unknown, B = unknown> {
  /** The input arguments passed to the task */
  input: InputType;
  /** The output returned by the task (if successful) */
  output?: OutputType | null;
  /** The error message if the task failed */
  error?: string;
  /** Boundary execution data */
  boundaries?: B;
  /** The name of the task (if set) */
  taskName?: string;
  /** Additional context metadata */
  metadata?: Record<string, string>;
  /** Array of collected metrics */
  metrics?: Metric[];
  /** Main function execution timing */
  timing?: TimingInfo;
  /** The type of execution record - computed from output/error state */
  type: 'success' | 'error' | 'pending';
}

/**
 * Validates a metric object to ensure it conforms to the Metric interface
 * @param metric - The metric object to validate
 * @returns true if the metric is valid, false otherwise
 */
export function validateMetric(metric: unknown): metric is Metric {
  if (typeof metric !== 'object' || metric === null) {
    return false
  }

  const m = metric as Record<string, unknown>

  return (
    typeof m.type === 'string' && m.type.length > 0 &&
    typeof m.name === 'string' && m.name.length > 0 &&
    typeof m.value === 'number' && !isNaN(m.value) && isFinite(m.value)
  )
}

/**
 * Creates a validated metric object
 * @param type - The metric type/category
 * @param name - The metric name
 * @param value - The metric value
 * @returns A valid Metric object
 * @throws Error if the metric data is invalid
 */
export function createMetric(type: string, name: string, value: number): Metric {
  const metric: Metric = { type, name, value }

  if (!validateMetric(metric)) {
    throw new Error(`Invalid metric: type="${type}", name="${name}", value=${value}`)
  }

  return metric
}
