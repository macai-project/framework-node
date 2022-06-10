import { Log, Logger } from './Logger'

export class LogStore {
  private logs: Log[] = []

  private clearStore = (l: Log) => {
    this.logs = this.logs.concat(l)
  }

  private printStore = () => {
    this.logs.forEach((l) => {
      this.logger.debug(l[0], l[1])
    })
  }

  constructor(
    private logger: Logger,
    public readonly capacity = Infinity,
    private areLogEnabled = () => process.env.FRAMEWORK_LOGS === 'true'
  ) {}

  public getCapacity = () => {
    return `${this.logs.length}/${this.capacity}`
  }

  public appendLog = (l: Log, level = 'debug') => {
    if (this.logs.length >= this.capacity) {
      this.logger.warn(
        `MAXIMUM LOG STORE CAPACITY EXCEEDED (${this.capacity} logs)`
      )
      return
    }

    if (this.areLogEnabled()) {
      switch (level) {
        case 'info':
          this.logger.info(l[0], l[1])
        case 'error':
          this.logger.warn(l[0], l[1])
        case 'error':
          this.logger.error(l[0], l[1])
        case 'debug':
          this.logger.debug(l[0], l[1])
        default:
          this.logger.info(l[0], l[1])
      }
    }

    this.logs.push(l)
  }

  public reset = () => {
    if (!this.areLogEnabled()) {
      this.printStore()
    }

    this.logs = []
  }
}
