import * as ts from 'typescript'

interface TaskLocation {
  file: string
  line: number
  column: number
}

interface SchemaProperty {
  name?: string
  type: string
  optional?: boolean
  default?: string
  properties?: Record<string, SchemaProperty>
}

interface InputSchema {
  type: string
  properties: Record<string, SchemaProperty>
}

interface OutputType {
  type: string
  properties?: Record<string, SchemaProperty>
  elementType?: OutputType
}

export interface FingerprintError {
  type: 'parsing' | 'analysis' | 'boundary' | 'schema'
  message: string
  location?: {
    file: string
    line?: number
    column?: number
  }
  details?: Record<string, unknown>
}

interface TaskFingerprint {
  name: string
  description?: string
  location: TaskLocation
  inputSchema: InputSchema
  outputType: OutputType
  boundaries: BoundaryFingerprint[]
  hash: string
}

interface BoundaryFingerprint {
  name: string
  input: SchemaProperty[]
  output: OutputType
  errors: FingerprintError[]
}

// Simplified interface for filesystem output (excludes name, location, hash)
export interface TaskFingerprintOutput {
  description?: string
  inputSchema: InputSchema
  outputType: OutputType
  boundaries: BoundaryFingerprint[]
  errors: FingerprintError[]
  analysisMetadata: {
    timestamp: string
    filePath: string
    success: boolean
    analysisVersion: string
  }
}

// Hash generation function
function generateHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

// TypeScript AST analysis function with error collection
function extractTaskFingerprintsWithErrors(sourceCode: string, filePath: string, errors: FingerprintError[]): TaskFingerprint[] {
  try {
    return extractTaskFingerprintsInternal(sourceCode, filePath, errors)
  } catch (error) {
    errors.push({
      type: 'parsing',
      message: error instanceof Error ? error.message : 'TypeScript parsing failed',
      location: { file: filePath },
      details: { error: error instanceof Error ? error.stack : String(error) }
    })
    return []
  }
}

// TypeScript AST analysis function with error collection
function extractTaskFingerprintsInternal(sourceCode: string, filePath: string, errors: FingerprintError[]): TaskFingerprint[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  )

  const fingerprints: TaskFingerprint[] = []
  const processedNodes = new Set<ts.Node>() // Track processed createTask nodes to prevent duplicates
  let schemaNode: ts.Expression | null = null
  let boundariesNode: ts.Expression | null = null

  // First pass: find schema and boundaries variable declarations
  function findVariables(node: ts.Node): void {
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach(decl => {
        if (ts.isIdentifier(decl.name)) {
          if (decl.name.text === 'schema' && decl.initializer) {
            schemaNode = decl.initializer
          } else if (decl.name.text === 'boundaries' && decl.initializer) {
            boundariesNode = decl.initializer
          }
        }
      })
    }
    ts.forEachChild(node, findVariables)
  }

  // Second pass: find createTask calls
  function findCreateTask(node: ts.Node): void {
    // Look for createTask calls
    if (ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'createTask') {

      if (!processedNodes.has(node)) {
        processedNodes.add(node)
        const taskName = extractTaskName(node, sourceFile)
        if (taskName) {
          const fingerprint = analyzeCreateTaskCall(node, sourceFile, filePath, taskName, schemaNode, boundariesNode, errors)
          if (fingerprint) {
            fingerprints.push(fingerprint)
          }
        }
      }
    }

    // Look for exported createTask assignments
    if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      node.declarationList.declarations.forEach(decl => {
        if (ts.isVariableDeclaration(decl) &&
          decl.initializer &&
          ts.isCallExpression(decl.initializer) &&
          ts.isIdentifier(decl.initializer.expression) &&
          decl.initializer.expression.text === 'createTask') {

          if (!processedNodes.has(decl.initializer)) {
            processedNodes.add(decl.initializer)
            const taskName = ts.isIdentifier(decl.name) ? decl.name.text : 'unknown'
            const fingerprint = analyzeCreateTaskCall(decl.initializer, sourceFile, filePath, taskName, schemaNode, boundariesNode, errors)
            if (fingerprint) {
              fingerprints.push(fingerprint)
            }
          }
        }
      })
    }

    ts.forEachChild(node, findCreateTask)
  }

  // Execute both passes
  findVariables(sourceFile)
  findCreateTask(sourceFile)

  return fingerprints
}

function extractTaskName(node: ts.CallExpression, _sourceFile: ts.SourceFile): string | null {
  // Try to find the task name from variable assignment or export
  let parent = node.parent
  while (parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text
    }
    parent = parent.parent
  }
  return null
}

function analyzeCreateTaskCall(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  taskName: string,
  schemaNode: ts.Expression | null = null,
  boundariesNode: ts.Expression | null = null,
  errors: FingerprintError[] = []
): TaskFingerprint | null {
  try {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart())
    const args = node.arguments

    // Analyze createTask({ schema, boundaries, fn }) structure
    let inputSchema: InputSchema = { type: 'object', properties: {} }
    let boundaries: BoundaryFingerprint[] = []
    let boundaryTypes: Map<string, OutputType> = new Map()

    if (args[0] && ts.isObjectLiteralExpression(args[0])) {
      const schemaProperty = args[0].properties.find(prop =>
        ts.isPropertyAssignment(prop) &&
        ts.isIdentifier(prop.name) &&
        prop.name.text === 'schema'
      )
      const boundariesProperty = args[0].properties.find(prop =>
        ts.isPropertyAssignment(prop) &&
        ts.isIdentifier(prop.name) &&
        prop.name.text === 'boundaries'
      )

      if (schemaNode) {
        try {
          inputSchema = analyzeSchemaArg(schemaNode, sourceFile)
        } catch (error) {
          errors.push({
            type: 'schema',
            message: error instanceof Error ? error.message : 'Schema analysis failed',
            location: { file: filePath, line: position.line + 1, column: position.character + 1 },
            details: { taskName, schemaSource: 'variable' }
          })
        }
      } else if (schemaProperty && ts.isPropertyAssignment(schemaProperty)) {
        try {
          inputSchema = analyzeSchemaArg(schemaProperty.initializer, sourceFile)
        } catch (error) {
          errors.push({
            type: 'schema',
            message: error instanceof Error ? error.message : 'Schema analysis failed',
            location: { file: filePath, line: position.line + 1, column: position.character + 1 },
            details: { taskName, schemaSource: 'property' }
          })
        }
      }

      if (boundariesNode) {
        try {
          const boundaryInfo = analyzeBoundariesWithTypes(boundariesNode, sourceFile)
          boundaries = boundaryInfo.boundaries
          boundaryTypes = boundaryInfo.types
        } catch (error) {
          errors.push({
            type: 'boundary',
            message: error instanceof Error ? error.message : 'Boundary analysis failed',
            location: { file: filePath, line: position.line + 1, column: position.character + 1 },
            details: { taskName, boundarySource: 'variable' }
          })
        }
      } else if (boundariesProperty && ts.isPropertyAssignment(boundariesProperty)) {
        try {
          const boundaryInfo = analyzeBoundariesWithTypes(boundariesProperty.initializer, sourceFile)
          boundaries = boundaryInfo.boundaries
          boundaryTypes = boundaryInfo.types
        } catch (error) {
          errors.push({
            type: 'boundary',
            message: error instanceof Error ? error.message : 'Boundary analysis failed',
            location: { file: filePath, line: position.line + 1, column: position.character + 1 },
            details: { taskName, boundarySource: 'property' }
          })
        }
      }
    }

    // Extract function output type with better detection
    let outputType: OutputType = { type: 'unknown' }
    let functionArg: ts.Expression | undefined

    // Extract function from createTask({ fn }) structure
    if (args[0] && ts.isObjectLiteralExpression(args[0])) {
      const fnProperty = args[0].properties.find(prop =>
        ts.isPropertyAssignment(prop) &&
        ts.isIdentifier(prop.name) &&
        prop.name.text === 'fn'
      )
      if (fnProperty && ts.isPropertyAssignment(fnProperty)) {
        functionArg = fnProperty.initializer
      }
    }

    if (functionArg) {
      if (ts.isFunctionExpression(functionArg) || ts.isArrowFunction(functionArg)) {
        // Collect errors from main task function
        const mainFunctionErrors = analyzeMainTaskFunctionErrors(functionArg, sourceFile, taskName)
        errors.push(...mainFunctionErrors)

        // Better return type extraction
        if (functionArg.type) {
          const typeString = cleanTypeString(functionArg.type.getText(sourceFile))
          outputType = { type: typeString }
        } else {
          // Try to infer from return statements with boundary type information
          outputType = inferDetailedReturnType(functionArg, sourceFile, boundaryTypes)
        }
      }
    }

    // Generate hash from task signature
    const boundaryNames = boundaries.map(b => b.name)
    const hashInput = `${taskName}:${JSON.stringify(inputSchema)}:${JSON.stringify(boundaryNames)}`
    const hash = generateHash(hashInput)

    return {
      name: taskName,
      location: {
        file: filePath,
        line: position.line + 1,
        column: position.character + 1
      },
      inputSchema,
      outputType,
      boundaries,
      hash
    }
  } catch (error) {
    console.warn(`Failed to analyze createTask call for ${taskName}:`, error)
    return null
  }
}

// Enhanced return type inference with detailed object analysis
function inferDetailedReturnType(func: ts.FunctionExpression | ts.ArrowFunction, sourceFile: ts.SourceFile, boundaryTypes: Map<string, OutputType> = new Map()): OutputType {
  let returnType: OutputType = { type: 'unknown' }

  // First, collect variable declarations and their types within the function
  const variableTypes = new Map<string, OutputType>()

  function collectVariableDeclarations(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const varName = node.name.text

      // Handle await expressions specially for boundary calls
      if (ts.isAwaitExpression(node.initializer) &&
          ts.isCallExpression(node.initializer.expression) &&
          ts.isIdentifier(node.initializer.expression.expression)) {

        const boundaryName = node.initializer.expression.expression.text
        const boundaryType = boundaryTypes.get(boundaryName)

        if (boundaryType && typeof boundaryType === 'object') {
          // Store the detailed type information
          variableTypes.set(varName, boundaryType)
        } else {
          const varType = inferTypeFromExpression(node.initializer, sourceFile, variableTypes, boundaryTypes)
          variableTypes.set(varName, { type: varType })
        }
      } else {
        const varType = inferTypeFromExpression(node.initializer, sourceFile, variableTypes, boundaryTypes)
        variableTypes.set(varName, { type: varType })
      }
    }
    ts.forEachChild(node, collectVariableDeclarations)
  }

  function visitReturnStatements(node: ts.Node): void {
    if (ts.isReturnStatement(node) && node.expression) {
      if (ts.isObjectLiteralExpression(node.expression)) {
        // Analyze object literal properties
        const properties: Record<string, SchemaProperty> = {}
        node.expression.properties.forEach(prop => {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            // Handle explicit property assignments: { propName: value }
            const propName = prop.name.text

            // Check if it's a property access like result1.result
            if (ts.isPropertyAccessExpression(prop.initializer)) {
              const baseExpr = prop.initializer.expression
              const propertyName = prop.initializer.name.text

              if (ts.isIdentifier(baseExpr)) {
                const baseVarType = variableTypes.get(baseExpr.text)
                if (baseVarType && typeof baseVarType === 'object' && baseVarType.properties) {
                  const propertyType = baseVarType.properties[propertyName]
                  if (propertyType) {
                    properties[propName] = propertyType
                  } else {
                    properties[propName] = { type: 'unknown' }
                  }
                } else {
                  properties[propName] = { type: 'unknown' }
                }
              } else {
                properties[propName] = { type: 'unknown' }
              }
            } else {
              const propType = inferTypeFromExpression(prop.initializer, sourceFile, variableTypes, boundaryTypes)

              // Handle identifiers that might reference boundary call results
              if (ts.isIdentifier(prop.initializer)) {
                const varType = variableTypes.get(prop.initializer.text)
                if (varType && typeof varType === 'object' && varType.type) {
                  properties[propName] = { type: varType.type }
                } else {
                  properties[propName] = { type: propType }
                }
              } else {
                properties[propName] = { type: propType }
              }
            }
          } else if (ts.isShorthandPropertyAssignment(prop)) {
            // Handle shorthand properties: { propName } (equivalent to { propName: propName })
            const propName = prop.name.text
            const varType = variableTypes.get(propName)

            if (varType && typeof varType === 'object' && varType.type) {
              // If we have detailed type information from boundary calls
              if (varType.type === 'object' && varType.properties) {
                properties[propName] = varType
              } else if (varType.type === 'array' && varType.elementType) {
                // Handle arrays with elementType information
                properties[propName] = varType
              } else {
                properties[propName] = { type: varType.type }
              }
            } else {
              const propType = varType ? (varType.type || 'unknown') : inferTypeFromIdentifier(prop.name.text, boundaryTypes)
              properties[propName] = { type: propType }
            }
          }
        })

        if (Object.keys(properties).length > 0) {
          returnType = {
            type: 'object',
            properties
          }
        } else {
          returnType = { type: 'object' }
        }
      } else if (ts.isStringLiteral(node.expression)) {
        returnType = { type: 'string' }
      } else if (ts.isNumericLiteral(node.expression)) {
        returnType = { type: 'number' }
      } else if (node.expression.kind === ts.SyntaxKind.TrueKeyword ||
        node.expression.kind === ts.SyntaxKind.FalseKeyword) {
        returnType = { type: 'boolean' }
      } else if (ts.isIdentifier(node.expression)) {
        // Single variable return
        const varType = variableTypes.get(node.expression.text)
        if (varType) {
          returnType = varType
        } else {
          const inferredType = inferTypeFromIdentifier(node.expression.text, boundaryTypes)
          returnType = { type: inferredType }
        }
      }
    }
    ts.forEachChild(node, visitReturnStatements)
  }

  if (func.body) {
    // First pass: collect variable declarations
    collectVariableDeclarations(func.body)
    // Second pass: analyze return statements
    visitReturnStatements(func.body)
  }

  return returnType
}

// Helper function to infer type from any expression
function inferTypeFromExpression(expr: ts.Expression, sourceFile: ts.SourceFile, variableTypes: Map<string, OutputType>, boundaryTypes: Map<string, OutputType> = new Map()): string {
  if (ts.isStringLiteral(expr)) {
    return 'string'
  } else if (ts.isNumericLiteral(expr)) {
    return 'number'
  } else if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword) {
    return 'boolean'
  } else if (ts.isArrayLiteralExpression(expr)) {
    return 'array'
  } else if (ts.isObjectLiteralExpression(expr)) {
    return 'object'
  } else if (ts.isIdentifier(expr)) {
    // Check if we know the type from variable declarations
    const varType = variableTypes.get(expr.text)
    if (varType) {
      return varType.type || 'unknown'
    }
    return inferTypeFromIdentifier(expr.text, boundaryTypes)
  } else if (ts.isCallExpression(expr)) {
    // Handle method calls like array.reduce(), boundary calls, etc.
    if (ts.isPropertyAccessExpression(expr.expression)) {
      const methodName = expr.expression.name.text
      if (methodName === 'reduce') {
        // For reduce, infer type from initial value (second argument)
        if (expr.arguments.length > 1) {
          const initialValue = expr.arguments[1]
          return inferTypeFromExpression(initialValue, sourceFile, variableTypes, boundaryTypes)
        }
        return 'number'  // Common case for reduce operations
      } else if (methodName === 'map' || methodName === 'filter') {
        // These typically return arrays
        return 'array'
      } else if (methodName === 'join' || methodName === 'toString') {
        // These return strings
        return 'string'
      } else if (methodName === 'length' || methodName === 'indexOf' || methodName === 'findIndex') {
        // These return numbers
        return 'number'
      }
    } else if (ts.isIdentifier(expr.expression)) {
      // Direct function calls - could be boundary functions
      const functionName = expr.expression.text
      const boundaryType = boundaryTypes.get(functionName)
      if (boundaryType) {
        // If boundaryType is an object with type info, return the type
        if (typeof boundaryType === 'object' && boundaryType.type) {
          return boundaryType.type
        }
        return typeof boundaryType === 'string' ? boundaryType : 'unknown'
      }
      return 'unknown'
    }
    return 'unknown'
  } else if (ts.isAwaitExpression(expr)) {
    // Handle await expressions - analyze the awaited expression
    return inferTypeFromExpression(expr.expression, sourceFile, variableTypes, boundaryTypes)
  } else if (ts.isPropertyAccessExpression(expr)) {
    // Handle property access like obj.prop - try to infer from base object
    const baseType = inferTypeFromExpression(expr.expression, sourceFile, variableTypes, boundaryTypes)
    if (baseType === 'object') {
      return 'unknown' // Could be any property type
    }
    return 'unknown'
  }

  return 'unknown'
}



// Clean up type strings (remove Promise wrappers for boundaries)
function cleanTypeString(typeString: string): string {
  // Remove Promise wrapper for boundary functions
  const promiseMatch = typeString.match(/Promise<(.+)>/)
  if (promiseMatch) {
    return promiseMatch[1]
  }
  return typeString
}

function analyzeSchemaArg(node: ts.Expression, sourceFile: ts.SourceFile): InputSchema {
  // Handle variable references (e.g., when schema is defined as const schema = ...)
  if (ts.isIdentifier(node) && node.text === 'schema') {
    // This case is now handled by pre-finding the schema node
    return { type: 'object', properties: {} }
  }

  // Handle direct Schema constructor calls
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Schema') {
    const arg = node.arguments?.[0]
    if (arg && ts.isObjectLiteralExpression(arg)) {
      const properties: Record<string, SchemaProperty> = {}
      arg.properties.forEach(prop => {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          const propName = prop.name.text
          const propValue = analyzeSchemaProp(prop.initializer, sourceFile)
          properties[propName] = propValue
        }
      })
      return { type: 'object', properties }
    }
  }
  return { type: 'object', properties: {} }
}

// Enhanced schema property analysis
function analyzeSchemaProp(node: ts.Expression, sourceFile: ts.SourceFile): SchemaProperty {
  // Analyze Schema.string(), Schema.number(), etc.
  if (ts.isCallExpression(node)) {
    if (ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Schema') {

      const methodName = node.expression.name.text
      const baseType: SchemaProperty = { type: getSchemaTypeFromMethod(methodName) }

      return baseType
    }
  }

  // Handle chained calls like Schema.number().optional()
  if (ts.isCallExpression(node)) {
    if (ts.isPropertyAccessExpression(node.expression)) {
      const chainedMethod = node.expression.name.text
      if (chainedMethod === 'optional') {
        // This is a .optional() call, get the base type
        const baseCall = node.expression.expression
        if (ts.isCallExpression(baseCall)) {
          const baseType = analyzeSchemaProp(baseCall, sourceFile)
          return { ...baseType, optional: true }
        }
      } else if (chainedMethod === 'default') {
        // This is a .default() call, get the base type
        const baseCall = node.expression.expression
        if (ts.isCallExpression(baseCall)) {
          const baseType = analyzeSchemaProp(baseCall, sourceFile)
          const defaultValue = node.arguments[0]?.getText() || 'undefined'
          return { ...baseType, default: defaultValue }
        }
      }
    }
  }

  return { type: 'unknown' }
}

function getSchemaTypeFromMethod(methodName: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    array: 'array',
    object: 'object'
  }
  return typeMap[methodName] || 'unknown'
}


// Enhanced boundary analysis that extracts detailed boundary information
function analyzeBoundariesWithTypes(node: ts.Expression, sourceFile: ts.SourceFile): { names: string[], types: Map<string, OutputType>, boundaries: BoundaryFingerprint[] } {
  const names: string[] = []
  const types = new Map<string, OutputType>()
  const boundaries: BoundaryFingerprint[] = []

  if (ts.isObjectLiteralExpression(node)) {
    node.properties.forEach(prop => {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        const boundaryName = prop.name.text
        names.push(boundaryName)

        const boundaryErrors: FingerprintError[] = []

        // Try to analyze the boundary function to extract input and output types
        if (ts.isArrowFunction(prop.initializer) || ts.isFunctionExpression(prop.initializer)) {
          try {
            // Analyze input parameters with error collection
            const inputAnalysis = analyzeBoundaryInputTypesWithErrors(prop.initializer, sourceFile, boundaryName)
            boundaryErrors.push(...inputAnalysis.errors)

            // Analyze return type with error collection
            const returnAnalysis = analyzeBoundaryReturnTypeWithErrors(prop.initializer, sourceFile, boundaryName)
            boundaryErrors.push(...returnAnalysis.errors)

            types.set(boundaryName, returnAnalysis.returnType)

            // Validate boundary structure and collect structural errors
            const structuralErrors = validateBoundaryStructure(prop.initializer, sourceFile, boundaryName)
            boundaryErrors.push(...structuralErrors)

            // Create boundary fingerprint
            const boundaryFingerprint: BoundaryFingerprint = {
              name: boundaryName,
              input: inputAnalysis.inputTypes,
              output: returnAnalysis.returnType,
              errors: boundaryErrors
            }

            boundaries.push(boundaryFingerprint)
          } catch (error) {
            boundaryErrors.push({
              type: 'boundary',
              message: error instanceof Error ? error.message : 'Boundary analysis failed',
              location: { file: sourceFile.fileName },
              details: { boundaryName, errorType: 'critical_analysis_failure' }
            })

            // Create boundary fingerprint with error
            const boundaryFingerprint: BoundaryFingerprint = {
              name: boundaryName,
              input: [],
              output: { type: 'unknown' },
              errors: boundaryErrors
            }

            boundaries.push(boundaryFingerprint)
          }
        } else {
          // Not a function - this is an error
          boundaryErrors.push({
            type: 'boundary',
            message: 'Boundary is not a function',
            location: { file: sourceFile.fileName },
            details: { boundaryName, nodeType: ts.SyntaxKind[prop.initializer.kind] }
          })

          const boundaryFingerprint: BoundaryFingerprint = {
            name: boundaryName,
            input: [],
            output: { type: 'unknown' },
            errors: boundaryErrors
          }

          boundaries.push(boundaryFingerprint)
        }
      }
    })
  }

  return { names, types, boundaries }
}

// Analyze boundary function input parameter types with error collection
function analyzeBoundaryInputTypesWithErrors(func: ts.ArrowFunction | ts.FunctionExpression, sourceFile: ts.SourceFile, boundaryName: string): { inputTypes: SchemaProperty[], errors: FingerprintError[] } {
  const inputTypes: SchemaProperty[] = []
  const errors: FingerprintError[] = []

  if (func.parameters) {
    func.parameters.forEach((param, index) => {
      if (ts.isIdentifier(param.name)) {
        const paramName = param.name.text

        if (param.type) {
          try {
            const typeText = param.type.getText(sourceFile)
            const schemaProperty = parseTypeToSchemaProperty(typeText)
            inputTypes.push({ ...schemaProperty, name: paramName })
          } catch (error) {
            errors.push({
              type: 'boundary',
              message: `Failed to parse parameter type for '${paramName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
              location: { file: sourceFile.fileName },
              details: { boundaryName, parameterName: paramName, parameterIndex: index }
            })
            inputTypes.push({ name: paramName, type: 'unknown' })
          }
        } else {
          // No type annotation - just use unknown
          inputTypes.push({ name: paramName, type: 'unknown' })
        }
      } else {
        // Complex parameter patterns (destructuring, etc.) - just use unknown
        inputTypes.push({ name: `param${index}`, type: 'unknown' })
      }
    })

    // Only check for obvious parameter issues
    if (func.parameters.length === 0) {
      errors.push({
        type: 'boundary',
        message: 'Boundary function has no parameters',
        location: { file: sourceFile.fileName },
        details: { boundaryName, issue: 'no_parameters' }
      })
    }
  }

  return { inputTypes, errors }
}


// Helper function to convert TypeScript type text to SchemaProperty
function parseTypeToSchemaProperty(typeText: string): SchemaProperty {
  // Remove whitespace
  const cleanType = typeText.trim()

  if (cleanType === 'string') {
    return { type: 'string' }
  } else if (cleanType === 'number') {
    return { type: 'number' }
  } else if (cleanType === 'boolean') {
    return { type: 'boolean' }
  } else if (cleanType.includes('[]') || cleanType.includes('Array<')) {
    return { type: 'array' }
  } else if (cleanType.includes('{') && cleanType.includes('}')) {
    // Parse object type structure
    const objectMatch = cleanType.match(/^\s*\{\s*(.+)\s*\}\s*$/)
    if (objectMatch) {
      const properties: Record<string, SchemaProperty> = {}
      const propsString = objectMatch[1]

      // Split by commas and semicolons
      const propPairs = propsString.split(/[,;]/).map(s => s.trim())

      for (const propPair of propPairs) {
        const colonIndex = propPair.indexOf(':')
        if (colonIndex > 0) {
          const propName = propPair.substring(0, colonIndex).trim()
          const propType = propPair.substring(colonIndex + 1).trim()

          properties[propName] = parseTypeToSchemaProperty(propType)
        }
      }

      return {
        type: 'object',
        properties
      }
    }
    return { type: 'object' }
  } else {
    return { type: cleanType }
  }
}

// Helper function to infer type from variable names using TypeScript compiler analysis
function inferTypeFromIdentifier(identifierText: string, boundaryTypes: Map<string, OutputType>): string {
  // Check boundary types first
  if (boundaryTypes.has(identifierText)) {
    const boundaryType = boundaryTypes.get(identifierText)
    if (typeof boundaryType === 'object' && boundaryType.type) {
      return boundaryType.type
    }
    return (typeof boundaryType === 'object' && boundaryType?.type) ? boundaryType.type : 'unknown'
  }

  // Use TypeScript's built-in type inference instead of hardcoded patterns
  // For now, return unknown and let the compiler handle it
  return 'unknown'
}

// Analyze boundary function return type with error collection
function analyzeBoundaryReturnTypeWithErrors(func: ts.ArrowFunction | ts.FunctionExpression, sourceFile: ts.SourceFile, boundaryName: string): { returnType: OutputType, errors: FingerprintError[] } {
  const errors: FingerprintError[] = []

  // Check if function has explicit return type annotation
  if (func.type) {
    try {
      const typeText = func.type.getText(sourceFile)

      // Handle Promise<T> types - extract T
      const promiseMatch = typeText.match(/Promise<(.+)>/)
      if (promiseMatch) {
        const innerType = promiseMatch[1]

        // Just process the type without validation

        // Parse detailed type patterns
        if (innerType.includes('[]') || innerType.includes('Array<')) {
          // Extract array element type
          let elementType = 'unknown'

          if (innerType.includes('[]')) {
            // Handle T[] format
            const elementTypeMatch = innerType.match(/^(.+)\[\]$/)
            if (elementTypeMatch) {
              const rawElementType = elementTypeMatch[1].trim()

              // Parse object element types
              if (rawElementType.includes('{') && rawElementType.includes('}')) {
                const objectType = parseObjectTypeFromString(rawElementType)
                if (objectType && objectType.properties) {
                  return {
                    returnType: {
                      type: 'array',
                      elementType: {
                        type: 'object',
                        properties: objectType.properties
                      }
                    },
                    errors
                  }
                }
              }

              elementType = rawElementType
            }
          } else if (innerType.includes('Array<')) {
            // Handle Array<T> format
            const elementTypeMatch = innerType.match(/Array<(.+)>/)
            if (elementTypeMatch) {
              elementType = elementTypeMatch[1].trim()
            }
          }

          return {
            returnType: {
              type: 'array',
              elementType: elementType === 'unknown' ? undefined : { type: elementType }
            },
            errors
          }
        } else if (innerType === 'string') {
          return { returnType: { type: 'string' }, errors }
        } else if (innerType === 'number') {
          return { returnType: { type: 'number' }, errors }
        } else if (innerType === 'boolean') {
          return { returnType: { type: 'boolean' }, errors }
        } else if (innerType.includes('{') && innerType.includes('}')) {
          // Try to parse object type structure from string
          try {
            const parsedType = parseObjectTypeFromString(innerType)
            return { returnType: parsedType, errors }
          } catch (parseError) {
            errors.push({
              type: 'boundary',
              message: `Failed to parse return type object structure: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
              location: { file: sourceFile.fileName },
              details: { boundaryName, returnType: innerType, issue: 'object_parse_failure' }
            })
            return { returnType: { type: 'object' }, errors }
          }
        }
      } else {
        // Not a Promise type - just use the type as-is
      }

      return { returnType: { type: cleanTypeString(typeText) }, errors }
    } catch (error) {
      errors.push({
        type: 'boundary',
        message: `Failed to analyze return type: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: { file: sourceFile.fileName },
        details: { boundaryName, issue: 'return_type_analysis_failure' }
      })
      return { returnType: { type: 'unknown' }, errors }
    }
  } else {
    // No return type annotation - will try to infer
  }

  // If no explicit type, try to infer from return statements
  if (func.body) {
    try {
      const returnType = inferDetailedReturnType(func, sourceFile, new Map())
      return { returnType, errors }
    } catch (error) {
      errors.push({
        type: 'boundary',
        message: `Failed to infer return type from function body: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: { file: sourceFile.fileName },
        details: { boundaryName, issue: 'return_type_inference_failure' }
      })
    }
  }

  return { returnType: { type: 'unknown' }, errors }
}


// Helper function to check for throw statements in boundary functions
function checkForBoundaryThrowStatements(node: ts.Node, sourceFile: ts.SourceFile, errors: FingerprintError[]): void {
  if (ts.isThrowStatement(node)) {
    let errorMessage = 'Boundary function contains throw statement'

    // Try to extract error message if it's a simple throw new Error('message')
    if (node.expression && ts.isNewExpression(node.expression)) {
      if (ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'Error' &&
          node.expression.arguments &&
          node.expression.arguments.length > 0) {
        const errorArg = node.expression.arguments[0]
        if (ts.isStringLiteral(errorArg)) {
          errorMessage = `Boundary function throws: ${errorArg.text}`
        }
      }
    }

    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart())
    errors.push({
      type: 'boundary',
      message: errorMessage,
      location: {
        file: sourceFile.fileName,
        line: position.line + 1,
        column: position.character + 1
      }
    })
  }
  ts.forEachChild(node, (childNode) => checkForBoundaryThrowStatements(childNode, sourceFile, errors))
}

// Validate boundary structure and collect structural errors (simplified to focus on runtime errors)
function validateBoundaryStructure(func: ts.ArrowFunction | ts.FunctionExpression, sourceFile: ts.SourceFile, _boundaryName: string): FingerprintError[] {
  const errors: FingerprintError[] = []

  // Check function body for potential runtime errors
  if (func.body) {
    if (ts.isBlock(func.body)) {
      checkForBoundaryThrowStatements(func.body, sourceFile, errors)
    }
  }

  return errors
}

// Helper function to check for throw statements in main task functions
function checkForMainTaskThrowStatements(node: ts.Node, sourceFile: ts.SourceFile, errors: FingerprintError[]): void {
  if (ts.isThrowStatement(node)) {
    let errorMessage = 'Main task function contains throw statement'

    // Try to extract error message if it's a simple throw new Error('message')
    if (node.expression && ts.isNewExpression(node.expression)) {
      if (ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'Error' &&
          node.expression.arguments &&
          node.expression.arguments.length > 0) {
        const errorArg = node.expression.arguments[0]
        if (ts.isStringLiteral(errorArg)) {
          errorMessage = `Main task function throws: ${errorArg.text}`
        } else if (ts.isTemplateExpression(errorArg)) {
          // Handle template literals like `User with ID ${userId} not found`
          const templateText = errorArg.getText(sourceFile)
          errorMessage = `Main task function throws: ${templateText.replace(/`/g, '')}`
        }
      }
    }

    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart())
    errors.push({
      type: 'analysis',
      message: errorMessage,
      location: {
        file: sourceFile.fileName,
        line: position.line + 1,
        column: position.character + 1
      }
    })
  }
  ts.forEachChild(node, (childNode) => checkForMainTaskThrowStatements(childNode, sourceFile, errors))
}

// Analyze main task function for throw statements and runtime errors
function analyzeMainTaskFunctionErrors(func: ts.ArrowFunction | ts.FunctionExpression, sourceFile: ts.SourceFile, _taskName: string): FingerprintError[] {
  const errors: FingerprintError[] = []

  // Check function body for potential runtime errors
  if (func.body) {
    if (ts.isBlock(func.body)) {
      checkForMainTaskThrowStatements(func.body, sourceFile, errors)
    }
  }

  return errors
}

// Helper function to parse object type structure from type string
function parseObjectTypeFromString(typeString: string): OutputType {
  // Simple parsing for common object patterns like "{ result: string }"
  const objectMatch = typeString.match(/^\s*\{\s*(.+)\s*\}\s*$/)
  if (objectMatch) {
    const properties: Record<string, SchemaProperty> = {}
    const propsString = objectMatch[1]

    // Split by commas (simple approach - doesn't handle nested objects)
    const propPairs = propsString.split(',').map(s => s.trim())

    for (const propPair of propPairs) {
      const colonIndex = propPair.indexOf(':')
      if (colonIndex > 0) {
        const propName = propPair.substring(0, colonIndex).trim()
        const propType = propPair.substring(colonIndex + 1).trim()

        if (propType === 'string') {
          properties[propName] = { type: 'string' }
        } else if (propType === 'number') {
          properties[propName] = { type: 'number' }
        } else if (propType === 'boolean') {
          properties[propName] = { type: 'boolean' }
        } else if (propType.includes('[]')) {
          properties[propName] = { type: 'array' }
        } else {
          properties[propName] = { type: propType }
        }
      }
    }

    return {
      type: 'object',
      properties
    }
  }

  return { type: 'object' }
}

// Export the core analysis function for reuse
export function analyzeTaskFile(sourceCode: string, filePath: string, _expectedTaskName?: string): TaskFingerprintOutput | null {
  const errors: FingerprintError[] = []
  const analysisMetadata = {
    timestamp: new Date().toISOString(),
    filePath,
    success: true,
    analysisVersion: '1.0.0'
  }

  try {
    const taskFingerprints = extractTaskFingerprintsWithErrors(sourceCode, filePath, errors)
    const taskFingerprint = taskFingerprints[0]

    if (!taskFingerprint) {
      errors.push({
        type: 'analysis',
        message: 'No task fingerprint found in file',
        location: { file: filePath },
        details: { reason: 'No createTask calls detected' }
      })
      analysisMetadata.success = false

      return {
        description: undefined,
        inputSchema: { type: 'object', properties: {} },
        outputType: { type: 'unknown' },
        boundaries: [],
        errors,
        analysisMetadata
      }
    }

    // Return simplified output without name, location, hash
    return {
      description: taskFingerprint.description,
      inputSchema: taskFingerprint.inputSchema,
      outputType: taskFingerprint.outputType,
      boundaries: taskFingerprint.boundaries,
      errors,
      analysisMetadata
    }
  } catch (error) {
    errors.push({
      type: 'parsing',
      message: error instanceof Error ? error.message : 'Unknown parsing error',
      location: { file: filePath },
      details: { error: error instanceof Error ? error.stack : String(error) }
    })
    analysisMetadata.success = false

    return {
      description: undefined,
      inputSchema: { type: 'object', properties: {} },
      outputType: { type: 'unknown' },
      boundaries: [],
      errors,
      analysisMetadata
    }
  }
}
