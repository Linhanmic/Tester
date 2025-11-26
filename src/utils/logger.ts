/**
 * 统一日志服务
 * 提供分级日志记录和输出管理
 */

import * as vscode from 'vscode';

/** 日志级别 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 日志记录器
 */
export class Logger {
  private outputChannel: vscode.OutputChannel;
  private minLevel: LogLevel;
  private showTimestamp: boolean;

  constructor(
    channelName: string,
    minLevel: LogLevel = LogLevel.INFO,
    showTimestamp: boolean = true
  ) {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
    this.minLevel = minLevel;
    this.showTimestamp = showTimestamp;
  }

  /**
   * 记录调试信息
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * 记录一般信息
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * 记录警告信息
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * 记录错误信息
   */
  error(message: string, error?: Error | any, ...args: any[]): void {
    let fullMessage = message;
    if (error) {
      if (error instanceof Error) {
        fullMessage += `\n错误: ${error.message}\n堆栈: ${error.stack}`;
      } else {
        fullMessage += `\n${JSON.stringify(error)}`;
      }
    }
    this.log(LogLevel.ERROR, fullMessage, ...args);
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level < this.minLevel) {
      return;
    }

    const levelStr = this.getLevelString(level);
    const timestamp = this.showTimestamp ? this.getTimestamp() : '';
    const prefix = timestamp ? `[${timestamp}] ${levelStr}` : levelStr;

    let fullMessage = `${prefix} ${message}`;
    if (args.length > 0) {
      fullMessage += ' ' + args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
    }

    this.outputChannel.appendLine(fullMessage);

    // 错误级别也输出到控制台
    if (level >= LogLevel.ERROR) {
      console.error(fullMessage);
    } else if (level === LogLevel.WARN) {
      console.warn(fullMessage);
    }
  }

  /**
   * 获取日志级别字符串
   */
  private getLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '[DEBUG]';
      case LogLevel.INFO:
        return '[INFO]';
      case LogLevel.WARN:
        return '[WARN]';
      case LogLevel.ERROR:
        return '[ERROR]';
      default:
        return '[UNKNOWN]';
    }
  }

  /**
   * 获取时间戳
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 23);
  }

  /**
   * 显示输出通道
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.outputChannel.clear();
  }

  /**
   * 设置最小日志级别
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * 销毁日志记录器
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * 创建日志记录器
 */
export function createLogger(
  channelName: string,
  minLevel: LogLevel = LogLevel.INFO
): Logger {
  return new Logger(channelName, minLevel);
}
