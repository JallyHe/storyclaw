const missingElectronApi = (): Error =>
  new Error('Electron preload API is not available. Run StoryClaw in the desktop client.')

export function getApi(): NonNullable<Window['api']> {
  if (!window.api) throw missingElectronApi()
  return window.api
}

export function getOptionalApi(): Window['api'] | undefined {
  return window.api
}

export function rejectMissingApi<T>(): Promise<T> {
  return Promise.reject(missingElectronApi())
}
