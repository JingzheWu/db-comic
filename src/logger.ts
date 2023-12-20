import chalk from 'chalk';

export class Logger {
  static logToggle = true;
  static success = (msg: string, gap?: boolean): void => {
    if (!Logger.logToggle) return;
    gap && console.log(chalk.greenBright(' '));
    console.log(chalk.greenBright(msg));
  };
  static fail = (msg: string): void => {
    if (!Logger.logToggle) return;
    console.log(chalk.bgRedBright(msg));
  };
  static start = (msg: string): void => {
    if (!Logger.logToggle) return;
    console.log(chalk.blueBright(' '));
    console.log(chalk.blueBright('------------------------'));
    console.log(chalk.blueBright(msg));
  };
  static log: typeof console.log = (...args) => {
    if (!Logger.logToggle) return;
    console.log(...args);
  };
  static error: typeof console.error = (...args) => {
    if (!Logger.logToggle) return;
    console.error(...args);
  };
  static warn: typeof console.warn = (...args) => {
    if (!Logger.logToggle) return;
    console.warn(...args);
  };
  static info: typeof console.info = (...args) => {
    if (!Logger.logToggle) return;
    console.info(...args);
  };
  static debug: typeof console.debug = (...args) => {
    if (!Logger.logToggle) return;
    console.debug(...args);
  };
  static group: typeof console.group = (...args) => {
    if (!Logger.logToggle) return;
    console.group(...args);
  };
  static groupCollapsed: typeof console.groupCollapsed = (...args) => {
    if (!Logger.logToggle) return;
    console.groupCollapsed(...args);
  };
  static groupEnd: typeof console.groupEnd = (...args) => {
    if (!Logger.logToggle) return;
    console.groupEnd(...args);
  };
}
