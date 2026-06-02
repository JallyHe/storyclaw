export class DatabaseSync {
  constructor() {
    throw new Error('node:sqlite is not available in this Electron runtime')
  }
}

export class StatementSync {
  constructor() {
    throw new Error('node:sqlite is not available in this Electron runtime')
  }
}
