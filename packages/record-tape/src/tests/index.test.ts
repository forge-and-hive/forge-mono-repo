import * as path from 'path'
import { RecordTape } from '../index'

const emptyPath = path.resolve('any')
const tapePath = path.resolve(__dirname, './fixtures/load')

describe('Base tests', () => {
  it('Load sync with no file should return a empty tape', () => {
    const tape = new RecordTape({ path: emptyPath })
    tape.loadSync()

    const data = tape.getLog()
    expect(data.length).toBe(0)
  })

  it('Load sync with fixture tape should return a tape with one element', () => {
    const tape = new RecordTape({ path: tapePath })
    tape.loadSync()

    const data = tape.getLog()
    expect(data.length).toBe(2)
  })

  it('Load with no file should return a empty tape', async () => {
    const tape = new RecordTape({ path: emptyPath })
    await tape.load()

    const data = tape.getLog()
    expect(data.length).toBe(0)
  })

  it('Load with fixture tape should return a tape with one element', async () => {
    type InputType = boolean[]
    type OutputType = boolean

    const tape = new RecordTape<InputType, OutputType>({ path: tapePath })
    await tape.load()

    const data = tape.getLog()
    expect(data.length).toBe(2)

    const successRecord = data[0]
    expect(successRecord.type).toBe('success')
    expect(successRecord.input).toEqual([true])
    expect(successRecord.output).toBe(true)
    expect(successRecord.error).toBeUndefined()

    const errorRecord = data[1]
    expect(errorRecord.type).toBe('error')
    expect(errorRecord.input).toEqual([true])
    expect(errorRecord.output).toBeUndefined()
    expect(errorRecord.error).toBe('invalid data')
  })

  it('Should create a new tape with generic types', () => {
    const tape = new RecordTape({ path: emptyPath })
    tape.push({ uuid: 'test-uuid-1', input: [{name: 'test'}], output: { age: 1 }, type: 'success', boundaries: {}, taskName: 'test' })
    tape.push({ uuid: 'test-uuid-2', input: [{name: 'test'}], error: 'test', type: 'error', boundaries: {}, taskName: 'test' })

    const data = tape.getLog()
    expect(data.length).toBe(2)

    const input = data[0].input
    const output = data[0].output
    const type = data[0].type
    const error = data[0].error

    expect(input).toEqual([{name: 'test'}])
    expect(output).toEqual({ age: 1 })
    expect(error).toBeUndefined()
    expect(type).toBe('success')

    const input2 = data[1].input
    const output2 = data[1].output
    const type2 = data[1].type
    const error2 = data[1].error

    expect(input2).toEqual([{name: 'test'}])
    expect(output2).toBeUndefined()
    expect(error2).toEqual('test')
    expect(type2).toBe('error')
  })
})
