/**
 * 任务管理器
 * 负责发送任务的创建、执行、暂停、继续、停止等操作
 */

import * as vscode from 'vscode';
import { SendTask, ExecutionState } from '../../types/executor.types';
import { CanFrame, CanFDFrame, SentCanMessage } from '../../types/device.types';
import { Logger } from '../../utils/logger';
import { formatDataBytes } from '../../utils/hexParser';

/**
 * 任务管理器
 */
export class TaskManager {
  private sendTasks: Map<number, SendTask> = new Map();
  private nextTaskId: number = 0;
  private executionState: ExecutionState = "idle";
  private logger: Logger;

  // 事件发射器
  private _onMessageSent: vscode.EventEmitter<SentCanMessage>;

  constructor(
    logger: Logger,
    onMessageSent: vscode.EventEmitter<SentCanMessage>
  ) {
    this.logger = logger;
    this._onMessageSent = onMessageSent;
  }

  /**
   * 获取当前执行状态
   */
  public getState(): ExecutionState {
    return this.executionState;
  }

  /**
   * 设置执行状态
   */
  public setState(state: ExecutionState): void {
    this.executionState = state;
  }

  /**
   * 创建并启动发送任务
   */
  public createSendTask(
    channelIndex: number,
    messageId: number,
    data: number[],
    intervalMs: number,
    repeatCount: number,
    device: any,
    channelHandle: number,
    isFD: boolean
  ): number {
    const taskId = this.nextTaskId++;

    const task: SendTask = {
      id: taskId,
      channelIndex,
      messageId,
      data: [...data],
      intervalMs,
      remainingCount: repeatCount,
      totalCount: repeatCount,
      timerId: null,
      isPaused: false,
      cmdStr: `tcans ${channelIndex},0x${messageId.toString(16).toUpperCase()},${formatDataBytes(data)},${intervalMs},${repeatCount}`,
      hasError: false,
    };

    this.sendTasks.set(taskId, task);

    // 启动任务定时器
    this.startTaskTimer(task, device, channelHandle, isFD);

    this.logger.info(`发送任务已创建: ID=${taskId}, ${task.cmdStr}`);

    return taskId;
  }

  /**
   * 启动任务定时器
   */
  private startTaskTimer(
    task: SendTask,
    device: any,
    channelHandle: number,
    isFD: boolean
  ): void {
    if (task.timerId) {
      return; // 已经有定时器在运行
    }

    task.timerId = setInterval(() => {
      if (task.isPaused) {
        return;
      }

      if (task.remainingCount <= 0) {
        this.logger.info(`任务 ${task.id} 已完成`);
        this.stopTask(task.id);
        return;
      }

      // 发送单帧
      const success = this.sendSingleFrame(device, channelHandle, task, isFD);

      if (success) {
        task.remainingCount--;
        this.logger.debug(
          `任务 ${task.id} 发送成功, 剩余: ${task.remainingCount}/${task.totalCount}`
        );
      } else {
        task.hasError = true;
        this.logger.error(`任务 ${task.id} 发送失败`);
        this.stopTask(task.id);
      }
    }, task.intervalMs);
  }

  /**
   * 发送单帧数据
   */
  private sendSingleFrame(
    device: any,
    channelHandle: number,
    task: SendTask,
    isFD: boolean
  ): boolean {
    try {
      if (isFD) {
        const frame: CanFDFrame = {
          id: task.messageId,
          len: task.data.length,
          data: [...task.data],
        };
        device.transmitFD(channelHandle, frame);
      } else {
        const frame: CanFrame = {
          id: task.messageId,
          dlc: task.data.length,
          data: [...task.data],
        };
        device.transmit(channelHandle, frame);
      }

      // 触发发送事件
      this._onMessageSent.fire({
        timestamp: Date.now(),
        channel: task.channelIndex,
        id: task.messageId,
        dlc: task.data.length,
        data: [...task.data],
        isFD,
      });

      return true;
    } catch (error: any) {
      this.logger.error(`发送帧失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 暂停所有任务
   */
  public pauseAllTasks(): void {
    for (const task of this.sendTasks.values()) {
      task.isPaused = true;
    }
    this.setState('paused');
    this.logger.info('所有发送任务已暂停');
  }

  /**
   * 继续所有任务
   */
  public resumeAllTasks(): void {
    for (const task of this.sendTasks.values()) {
      task.isPaused = false;
    }
    this.setState('running');
    this.logger.info('所有发送任务已继续');
  }

  /**
   * 停止所有任务
   */
  public stopAllTasks(): void {
    for (const taskId of this.sendTasks.keys()) {
      this.stopTask(taskId);
    }
    this.sendTasks.clear();
    this.setState('stopped');
    this.logger.info('所有发送任务已停止');
  }

  /**
   * 停止单个任务
   */
  public stopTask(taskId: number): void {
    const task = this.sendTasks.get(taskId);
    if (!task) {
      return;
    }

    if (task.timerId) {
      clearInterval(task.timerId);
      task.timerId = null;
    }

    this.sendTasks.delete(taskId);
    this.logger.debug(`任务 ${taskId} 已停止`);
  }

  /**
   * 获取活动任务数量
   */
  public getActiveTaskCount(): number {
    return this.sendTasks.size;
  }

  /**
   * 检查是否有正在运行的任务
   */
  public hasActiveTasks(): boolean {
    return this.sendTasks.size > 0;
  }

  /**
   * 获取所有任务
   */
  public getAllTasks(): Map<number, SendTask> {
    return this.sendTasks;
  }
}
