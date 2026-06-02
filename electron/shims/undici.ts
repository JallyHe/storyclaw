type Dispatcher = unknown

const unavailable = (name: string): never => {
  throw new Error(`undici.${name} is not available in the Electron main-process shim`)
}

let globalDispatcher: Dispatcher

export class Agent {
  readonly options: unknown

  constructor(options?: unknown) {
    this.options = options
  }
}

export class ProxyAgent extends Agent {
  readonly uri: unknown

  constructor(uri: unknown, options?: unknown) {
    super(options)
    this.uri = uri
  }
}

export class EnvHttpProxyAgent extends Agent {}

export const fetch = globalThis.fetch.bind(globalThis)
export const Headers = globalThis.Headers
export const Request = globalThis.Request
export const Response = globalThis.Response
export const FormData = globalThis.FormData
export const File = globalThis.File
export const Blob = globalThis.Blob

export const errors = {}
export const caches = globalThis.caches
export const cacheStores = {
  MemoryCacheStore: class MemoryCacheStore {}
}

export function setGlobalDispatcher(dispatcher: Dispatcher): void {
  globalDispatcher = dispatcher
}

export function getGlobalDispatcher(): Dispatcher {
  return globalDispatcher
}

export function install(): void {
  Object.assign(globalThis, {
    fetch,
    Headers,
    Request,
    Response,
    FormData,
    File,
    Blob
  })
}

export const request = (): never => unavailable('request')
export const stream = (): never => unavailable('stream')
export const pipeline = (): never => unavailable('pipeline')
export const connect = (): never => unavailable('connect')
export const upgrade = (): never => unavailable('upgrade')

export default {
  Agent,
  ProxyAgent,
  EnvHttpProxyAgent,
  fetch,
  Headers,
  Request,
  Response,
  FormData,
  File,
  Blob,
  errors,
  caches,
  cacheStores,
  setGlobalDispatcher,
  getGlobalDispatcher,
  install,
  request,
  stream,
  pipeline,
  connect,
  upgrade
}
