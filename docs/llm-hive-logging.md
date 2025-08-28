# LLM Guide: Sending Logs to Hive (v0)

This guide explains how to integrate Forge&Hive task execution logging with the Hive platform for monitoring, analysis, and quality assessment. It's designed for Large Language Models (LLMs) working on applications that need to send task execution records to Hive.

**Note**: This documentation covers the `@forgehive/hive-sdk` package for sending logs to the Hive platform.

**Package Version:**
- `@forgehive/hive-sdk`: Latest

## Overview

Hive provides two main integration approaches:

1. **Automatic Integration**: Let tasks automatically send logs to Hive using global listeners
2. **Manual Integration**: Send logs manually using the Hive SDK client for fine-grained control

Both approaches support metadata filtering and metrics aggregation across execution records.

## Installation

```bash
npm install @forgehive/hive-sdk
```

or with pnpm:

```bash
pnpm add @forgehive/hive-sdk
```

## Setup and Configuration

### 1. Get Your Credentials

Get your API credentials at [https://www.forgehive.cloud](https://www.forgehive.cloud).

You'll need:
- **API Key**: Your unique API key
- **API Secret**: Your secret key for authentication
- **Host** (optional): Hive instance URL (defaults to `https://www.forgehive.cloud`)

### 2. Configuration Options

#### Option A: Environment Variables (Recommended)

```bash
# Set environment variables
HIVE_API_KEY=your_api_key_here
HIVE_API_SECRET=your_api_secret_here
HIVE_HOST=https://your-hive-instance.com  # Optional, defaults to https://www.forgehive.cloud
```

#### Option B: Explicit Configuration

```typescript
import { HiveLogClient } from '@forgehive/hive-sdk'

const config = {
  projectName: 'My Project',
  apiKey: 'your_api_key_here',
  apiSecret: 'your_api_secret_here',
  host: 'https://your-hive-instance.com', // Optional
  metadata: { // Optional base metadata for all logs
    environment: 'production',
    version: '1.2.0'
  }
}
```

## Approach 1: Automatic Integration (Recommended)

Use this approach when you want all task executions to automatically send logs to Hive without manual intervention.

### Setting Up Global Listener

```typescript
import { Task } from '@forgehive/task'
import { HiveLogClient } from '@forgehive/hive-sdk'

// Create Hive client
const hiveClient = new HiveLogClient({
  projectName: 'Personal Knowledge Management System',
  metadata: {
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    service: 'document-processing'
  }
})

// Set up global listener for all task executions
Task.listenExecutionRecords(async (record) => {
  if (hiveClient.isActive()) {
    await hiveClient.sendLog(record, {
      // Add execution-specific metadata
      executionId: record.uuid,
      timestamp: new Date().toISOString()
    })
  }
})
```

### Benefits of Automatic Integration

- **Zero configuration per task**: All tasks automatically send logs
- **Consistent logging**: Every execution is captured
- **No manual intervention**: Works with existing task code
- **Metadata inheritance**: Base metadata is applied to all logs

### Example with Automatic Logging

```typescript
// Your existing task - no changes needed!
const processDocumentTask = createTask({
  name: 'processDocument',
  description: 'Extract text from uploaded document',
  schema: new Schema({
    documentId: Schema.string(),
    format: Schema.string()
  }),
  boundaries: {
    readFile: async (path) => { /* File reading */ },
    extractText: async (content, format) => { /* Text extraction */ },
    saveText: async (text, id) => { /* Save extracted text */ }
  },
  fn: async ({ documentId, format }, { readFile, extractText, saveText, setMetadata }) => {
    // Task automatically records metadata and metrics
    await setMetadata('documentId', documentId)
    await setMetadata('inputFormat', format)
    
    const content = await readFile(`/docs/${documentId}`)
    const text = await extractText(content, format)
    const result = await saveText(text, documentId)
    
    return { success: true, textLength: text.length }
  }
})

// Just run the task - logging happens automatically
const [result, error, record] = await processDocumentTask.safeRun({
  documentId: 'doc-123',
  format: 'pdf'
})

// Log is automatically sent to Hive with:
// - Task execution record (input, output, boundaries)
// - Metadata: documentId, inputFormat, environment, version, service
// - Global listener handles the sending
```

## Approach 2: Manual Integration

Use this approach when you need fine-grained control over which logs to send, when to send them, or how to process them before sending.

### Creating a Manual Client

```typescript
import { HiveLogClient } from '@forgehive/hive-sdk'

// Create client with explicit configuration
const hiveLogger = new HiveLogClient({
  projectName: 'Document Processing Service',
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  metadata: {
    environment: 'production',
    version: '2.1.0',
    datacenter: 'us-east-1'
  }
})

// Check if client is properly configured
if (hiveLogger.isActive()) {
  console.log('Hive logging is active')
} else {
  console.log('Running in silent mode - no credentials configured')
}
```

### Manual Log Sending

```typescript
const analyzeUserBehaviorTask = createTask({
  name: 'analyzeUserBehavior',
  description: 'Analyze user interaction patterns',
  schema: new Schema({
    userId: Schema.string(),
    sessionId: Schema.string(),
    actions: Schema.array(Schema.string())
  }),
  boundaries: {
    getUserData: async (userId) => { /* Fetch user data */ },
    analyzePattern: async (actions) => { /* ML analysis */ },
    storeInsights: async (insights) => { /* Store results */ }
  },
  fn: async ({ userId, sessionId, actions }, { getUserData, analyzePattern, storeInsights, setMetadata, setMetrics }) => {
    await setMetadata('userId', userId)
    await setMetadata('sessionId', sessionId)
    
    const userData = await getUserData(userId)
    const startTime = Date.now()
    
    const insights = await analyzePattern(actions)
    
    // Record performance metric
    await setMetrics({
      name: 'analysis_duration',
      value: Date.now() - startTime,
      unit: 'milliseconds',
      labels: {
        userType: userData.type,
        actionsCount: actions.length.toString()
      }
    })
    
    await storeInsights(insights)
    
    return { 
      insights,
      confidence: insights.confidence,
      processingTime: Date.now() - startTime
    }
  }
})

// Run task and manually send logs with custom logic
const [result, error, record] = await analyzeUserBehaviorTask.safeRun({
  userId: 'user-456',
  sessionId: 'session-789',
  actions: ['click', 'scroll', 'click', 'purchase']
})

// Custom logic for sending logs
if (result && result.confidence > 0.8) {
  // Only send logs for high-confidence analyses
  const status = await hiveLogger.sendLog(record, {
    confidenceLevel: result.confidence.toString(),
    resultQuality: 'high',
    analyticsType: 'behavioral'
  })
  
  console.log('Log status:', status) // 'success', 'error', or 'silent'
} else if (error) {
  // Send error logs with additional context
  await hiveLogger.sendLog(record, {
    errorType: 'analysis_failure',
    debugFlag: 'true'
  })
}
```

### Benefits of Manual Integration

- **Selective logging**: Choose which executions to log
- **Custom metadata**: Add execution-specific metadata
- **Error handling**: Custom error logging strategies  
- **Performance optimization**: Avoid logging low-value executions
- **Conditional logic**: Send logs based on results or conditions

## Advanced Features

### Metadata Priority System

Metadata is merged with the following priority (highest to lowest):

1. **sendLog metadata** - Metadata passed to `sendLog()` method
2. **Record metadata** - Metadata from task execution (set via `setMetadata`)
3. **Client base metadata** - Metadata set when creating the client

```typescript
// Client base metadata (lowest priority)
const client = new HiveLogClient({
  projectName: 'My Service',
  metadata: {
    environment: 'production',
    version: '1.0.0',
    team: 'backend'
  }
})

// Task execution record has metadata (medium priority)
const [result, error, record] = await myTask.safeRun(input)
// record.metadata = { userId: 'user-123', sessionId: 'session-456' }

// sendLog metadata has highest priority
await client.sendLog(record, {
  requestId: 'req-789',
  version: '1.1.0'  // This overrides client version
})

// Final metadata sent to Hive:
// {
//   environment: 'production',  // from client
//   team: 'backend',            // from client  
//   userId: 'user-123',         // from record
//   sessionId: 'session-456',   // from record
//   version: '1.1.0',           // from sendLog (highest priority)
//   requestId: 'req-789'        // from sendLog
// }
```

### Retrieving Logs

```typescript
// Get a specific log entry
try {
  const logData = await hiveLogger.getLog('processDocument', 'log-uuid-123')
  
  if (logData && !isApiError(logData)) {
    console.log('Retrieved log:', logData.logItem)
    console.log('Boundaries executed:', Object.keys(logData.logItem.boundaries))
    console.log('Metadata:', logData.logItem.metadata)
  } else if (logData && isApiError(logData)) {
    console.error('API Error:', logData.error)
  }
} catch (error) {
  console.error('Missing credentials:', error.message)
}
```

### Setting Quality Assessments

```typescript
import { Quality, isApiError } from '@forgehive/hive-sdk'

// Define quality assessment
const quality: Quality = {
  score: 8.5,
  reason: 'Good performance with accurate results',
  suggestions: 'Consider optimizing the text extraction algorithm for better speed'
}

try {
  const success = await hiveLogger.setQuality('processDocument', 'log-uuid-123', quality)
  
  if (success) {
    console.log('Quality assessment saved successfully')
  } else {
    console.error('Failed to save quality assessment')
  }
} catch (error) {
  console.error('Missing credentials:', error.message)
}
```

## Error Handling Patterns

### Silent Mode Operation

The SDK operates in "silent mode" when credentials are missing:

```typescript
const hiveLogger = new HiveLogClient({
  projectName: 'My Project'
  // No credentials provided - uses environment variables or goes silent
})

// sendLog never throws errors
const status = await hiveLogger.sendLog(record)
switch (status) {
  case 'success':
    console.log('Log sent successfully')
    break
  case 'error':
    console.error('Network or API error occurred')
    break
  case 'silent':
    console.log('Running in silent mode - no credentials configured')
    break
}

// Other methods throw when credentials are missing
if (hiveLogger.isActive()) {
  // Safe to use getLog and setQuality
  const logData = await hiveLogger.getLog('task', 'uuid')
  await hiveLogger.setQuality('task', 'uuid', quality)
} else {
  console.log('Client not active - getLog and setQuality will throw')
}
```

### Production Error Handling

```typescript
// Robust error handling for production
async function sendLogSafely(client: HiveLogClient, record: ExecutionRecord, metadata?: Metadata) {
  try {
    const status = await client.sendLog(record, metadata)
    
    if (status === 'error') {
      // Log to your monitoring system
      console.error('Failed to send log to Hive - network/API error')
      // Could implement retry logic here
    } else if (status === 'silent') {
      // Maybe log to local file or alternative service
      console.log('Hive unavailable, logging locally')
    }
    
    return status
  } catch (error) {
    // Should never happen with sendLog, but handle just in case
    console.error('Unexpected error sending log:', error)
    return 'error'
  }
}
```

## Integration Examples

### Express.js API Integration

```typescript
import express from 'express'
import { Task } from '@forgehive/task'
import { HiveLogClient } from '@forgehive/hive-sdk'

const app = express()
const hiveLogger = new HiveLogClient({
  projectName: 'API Gateway',
  metadata: {
    environment: process.env.NODE_ENV,
    service: 'user-api'
  }
})

// Option 1: Global listener (automatic)
Task.listenExecutionRecords(hiveLogger.getListener())

app.post('/api/users', async (req, res) => {
  const [result, error, record] = await createUserTask.safeRun(req.body)
  
  if (error) {
    // Option 2: Manual logging with request context
    await hiveLogger.sendLog(record, {
      requestId: req.headers['x-request-id'] as string,
      userAgent: req.headers['user-agent'] as string,
      ipAddress: req.ip
    })
    
    res.status(500).json({ error: error.message })
  } else {
    res.json(result)
  }
})
```

### AWS Lambda Integration

```typescript
import { Task } from '@forgehive/task'
import { HiveLogClient } from '@forgehive/hive-sdk'

// Set up automatic logging for Lambda
const hiveLogger = new HiveLogClient({
  projectName: 'Document Processor',
  metadata: {
    environment: 'lambda',
    runtime: process.env.AWS_EXECUTION_ENV
  }
})

Task.listenExecutionRecords(async (record) => {
  await hiveLogger.sendLog(record, {
    lambdaRequestId: process.env.AWS_REQUEST_ID,
    lambdaFunction: process.env.AWS_LAMBDA_FUNCTION_NAME
  })
})

// Your Lambda handler
export const handler = async (event: any, context: any) => {
  const [result, error] = await processDocumentTask.safeRun(event)
  
  if (error) {
    throw error
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify(result)
  }
}
```

## Best Practices

### 1. Use Environment Variables for Credentials
```bash
# Production
HIVE_API_KEY=prod_key_xyz
HIVE_API_SECRET=prod_secret_abc
HIVE_HOST=https://your-production-hive.com

# Development  
HIVE_API_KEY=dev_key_123
HIVE_API_SECRET=dev_secret_456
```

### 2. Set Base Metadata for Context
```typescript
const client = new HiveLogClient({
  projectName: 'My Service',
  metadata: {
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
    hostname: os.hostname(),
    region: process.env.AWS_REGION
  }
})
```

### 3. Choose Integration Approach Based on Needs

**Use Automatic Integration when:**
- You want comprehensive logging of all tasks
- You have consistent metadata requirements
- You prefer zero configuration per task
- You're building a new application

**Use Manual Integration when:**
- You need selective logging (only certain tasks or conditions)
- You have complex metadata requirements per execution
- You want custom error handling for logging
- You're integrating with existing applications

### 4. Handle Silent Mode Gracefully
```typescript
// Check client status on startup
if (hiveLogger.isActive()) {
  console.log('✅ Hive logging enabled')
} else {
  console.log('⚠️ Hive logging in silent mode - check credentials')
}
```

### 5. Use Meaningful Metadata
```typescript
// Good metadata for filtering and analysis
await client.sendLog(record, {
  userId: user.id,
  requestId: req.id,
  feature: 'document-upload',
  userTier: user.tier,
  processedSize: file.size.toString()
})
```

## Quick Reference

### Essential Imports
```typescript
import { HiveLogClient, isApiError, Quality } from '@forgehive/hive-sdk'
import { Task } from '@forgehive/task'
```

### Automatic Setup
```typescript
const client = new HiveLogClient({ projectName: 'My Project' })
Task.listenExecutionRecords(client.getListener())
```

### Manual Setup
```typescript  
const client = new HiveLogClient({ 
  projectName: 'My Project',
  apiKey: 'key',
  apiSecret: 'secret'
})

const status = await client.sendLog(record, metadata)
```

### Error Handling
```typescript
if (client.isActive()) {
  // Can use all methods
} else {
  // Only sendLog works (returns 'silent')
}
```

This guide provides the essential patterns for integrating Forge&Hive task logging with the Hive platform. Choose the approach that best fits your application's architecture and logging requirements.