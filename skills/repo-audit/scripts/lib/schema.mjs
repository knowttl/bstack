import { CommandError } from './result.mjs'
import { canonicalJSON } from './fingerprint.mjs'

// Only keywords exercised by installed input formats belong to this subset.
const keywords = ['$schema', 'title', 'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'minLength', 'pattern']
// JSON types distinguish arrays from objects and exclude JavaScript-only values.
const types = ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function matchesType(value, type) {
  if (type === 'object') return object(value)
  if (type === 'array') return Array.isArray(value)
  if (type === 'null') return value === null
  if (type === 'integer') return Number.isInteger(value)
  return typeof value === type && (type !== 'number' || Number.isFinite(value))
}

export function validateSchema(schema) {
  const problems = []
  function visit(node, path) {
    const invalid = message => problems.push({ code: 'invalid-schema', message, path, fix: 'Use the documented schema subset and keyword value types.' })
    if (!object(node)) { invalid('A schema must be an object.'); return }
    for (const key of Object.keys(node)) {
      if (!keywords.includes(key)) problems.push({ code: 'unsupported-keyword', message: `Unsupported schema keyword: ${key}`, path: `${path}/${key}`, fix: `Remove ${key} or extend the tested schema subset in its owning task.` })
    }
    for (const key of ['$schema', 'title', 'pattern']) {
      if (Object.hasOwn(node, key) && typeof node[key] !== 'string') invalid(`${key} must be a string.`)
    }
    if (typeof node.pattern === 'string') {
      try { new RegExp(node.pattern, 'u') } catch { invalid(`Invalid pattern: ${node.pattern}`) }
    }
    if (Object.hasOwn(node, 'type')) {
      const selected = Array.isArray(node.type) ? node.type : [node.type]
      if (!selected.length || selected.some(type => !types.includes(type)) || new Set(selected).size !== selected.length) invalid('type must name unique supported JSON types.')
    }
    for (const key of ['minItems', 'minLength']) {
      if (Object.hasOwn(node, key) && (!Number.isSafeInteger(node[key]) || node[key] < 0)) invalid(`${key} must be a nonnegative safe integer.`)
    }
    if (Object.hasOwn(node, 'enum') && (!Array.isArray(node.enum) || !node.enum.length || new Set(node.enum.map(canonicalJSON)).size !== node.enum.length)) invalid('enum must be a nonempty array of unique JSON values.')
    if (Object.hasOwn(node, 'required') && (!Array.isArray(node.required) || node.required.some(key => typeof key !== 'string') || new Set(node.required).size !== node.required.length)) invalid('required must be an array of unique field names.')
    if (Object.hasOwn(node, 'properties')) {
      if (!object(node.properties)) invalid('properties must be an object of schemas.')
      else for (const [key, child] of Object.entries(node.properties)) visit(child, `${path}/properties/${key}`)
    }
    if (Object.hasOwn(node, 'items')) visit(node.items, `${path}/items`)
    if (Object.hasOwn(node, 'additionalProperties') && typeof node.additionalProperties !== 'boolean') visit(node.additionalProperties, `${path}/additionalProperties`)
  }
  visit(schema, '$')
  if (problems.length) throw new CommandError('failed', problems)
}

export function validateData(schema, data) {
  validateSchema(schema)
  const problems = []
  function visit(node, value, path) {
    const problem = (code, message, at = path) => problems.push({ code, message, path: at, fix: 'Supply data matching the documented input schema.' })
    if (node.type && !(Array.isArray(node.type) ? node.type : [node.type]).some(type => matchesType(value, type))) {
      problem('invalid-type', `Expected ${JSON.stringify(node.type)}.`)
      return
    }
    if (Object.hasOwn(node, 'const') && canonicalJSON(value) !== canonicalJSON(node.const)) problem('invalid-const', `Expected constant ${JSON.stringify(node.const)}.`)
    if (node.enum && !node.enum.some(item => canonicalJSON(item) === canonicalJSON(value))) problem('invalid-enum', 'Value is not in the allowed enum.')
    if (typeof value === 'string') {
      if (node.minLength !== undefined && [...value].length < node.minLength) problem('min-length', `Expected at least ${node.minLength} characters.`)
      if (node.pattern !== undefined && !new RegExp(node.pattern, 'u').test(value)) problem('invalid-pattern', `Value must match ${node.pattern}.`)
    }
    if (Array.isArray(value)) {
      if (node.minItems !== undefined && value.length < node.minItems) problem('min-items', `Expected at least ${node.minItems} items.`)
      if (node.items) value.forEach((item, index) => visit(node.items, item, `${path}/${index}`))
    }
    if (object(value)) {
      for (const key of node.required ?? []) {
        if (!Object.hasOwn(value, key)) problem('missing-field', `Missing required field: ${key}`, `${path}/${key}`)
      }
      for (const [key, item] of Object.entries(value)) {
        if (Object.hasOwn(node.properties ?? {}, key)) visit(node.properties[key], item, `${path}/${key}`)
        else if (node.additionalProperties === false) problem('unknown-field', `Unknown input field: ${key}`, `${path}/${key}`)
        else if (object(node.additionalProperties)) visit(node.additionalProperties, item, `${path}/${key}`)
      }
    }
  }
  visit(schema, data, '$')
  if (problems.length) throw new CommandError('failed', problems)
}

export function validateIds(records, path) {
  const problems = []
  const seen = new Set()
  records.forEach((record, index) => {
    const id = record?.id
    const location = `${path}/${index}/id`
    if (typeof id !== 'string' || !id.trim()) problems.push({ code: 'missing-id', message: 'Missing nonempty joining ID.', path: location, fix: 'Supply a nonempty string ID for every record.' })
    else if (seen.has(id)) problems.push({ code: 'duplicate-id', message: `Duplicate joining ID: ${id}`, path: location, fix: 'Use a unique ID for each record in this collection.' })
    else seen.add(id)
  })
  if (problems.length) throw new CommandError('failed', problems)
}
