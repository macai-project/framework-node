import { Log, Logger } from "./Logger";

export class LogStore {
  private logs: Log[] = [];

  private areLogEnabled = () => process.env.FRAMEWORK_LOGS === "true";

  constructor(private logger: Logger, public readonly capacity = Infinity) {}

  public appendLog = (l: Log) => {
    if (this.logs.length > this.capacity) {
      this.logger.warn(
        `MAXIMUM LOG STORE CAPACITY EXEEDED (${this.capacity} logs)`
      );
      return;
    }

    if (this.areLogEnabled()) {
      this.logger.debug(...l);
    }

    this.logs = this.logs.concat(l);
  };

  public clearStore = (l: Log) => {
    this.logs = this.logs.concat(l);
  };

  public printStore = () => {
    this.logs.forEach((l) => this.logger.debug(...l));
  };

  public resetStore = () => {
    if (!this.areLogEnabled()) {
      this.printStore();
    }

    this.logs = [];
  };
}
