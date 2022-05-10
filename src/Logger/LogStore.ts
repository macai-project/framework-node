import { Log, Logger } from "./Logger";

export class LogStore {
  private logs: Log[] = [];

  private clearStore = (l: Log) => {
    this.logs = this.logs.concat(l);
  };

  private printStore = () => {
    this.logs.forEach((l) => {
      this.logger.debug(l[0], l[1]);
    });
  };

  constructor(
    private logger: Logger,
    public readonly capacity = Infinity,
    private areLogEnabled = () => process.env.FRAMEWORK_LOGS === "true"
  ) { }

  public getCapacity = () => {
    return `${this.logs.length}/${this.capacity}`;
  };

  public appendLog = (l: Log) => {
    if (this.logs.length >= this.capacity) {
      this.logger.warn(
        `MAXIMUM LOG STORE CAPACITY EXEEDED (${this.capacity} logs)`
      );
      return;
    }

    if (this.areLogEnabled()) {
      this.logger.debug(l[0], l[1]);
    }

    this.logs.push(l);
  };

  public reset = () => {
    if (!this.areLogEnabled()) {
      this.printStore();
    }

    this.logs = [];
  };
}
