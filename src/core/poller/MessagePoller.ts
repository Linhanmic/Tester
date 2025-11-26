/**
 * 报文轮询器
 * 负责轮询接收CAN报文并触发事件
 */

import * as vscode from 'vscode';
import { ReceivedCanMessage, ReceivedFrame, ReceivedFDFrame } from '../../types/device.types';
import { Logger } from '../../utils/logger';
import { RECEIVE_POLLING } from '../../utils/constants';

/**
 * 报文轮询器
 */
export class MessagePoller {
  private pollingTimer: ReturnType<typeof globalThis.setInterval> | null = null;
  private isPolling: boolean = false;
  private logger: Logger;

  // 事件发射器
  private _onMessageReceived: vscode.EventEmitter<ReceivedCanMessage>;

  constructor(
    logger: Logger,
    onMessageReceived: vscode.EventEmitter<ReceivedCanMessage>
  ) {
    this.logger = logger;
    this._onMessageReceived = onMessageReceived;
  }

  /**
   * 启动报文接收轮询
   */
  public startPolling(
    device: any,
    channelHandles: Map<number, number>,
    isCanFD: Map<number, boolean>
  ): void {
    if (this.isPolling) {
      this.logger.warn('报文轮询已在运行');
      return;
    }

    this.isPolling = true;
    this.pollingTimer = setInterval(() => {
      this.pollMessages(device, channelHandles, isCanFD);
    }, RECEIVE_POLLING.INTERVAL_MS);

    this.logger.info(`报文接收轮询已启动 (间隔: ${RECEIVE_POLLING.INTERVAL_MS}ms)`);
  }

  /**
   * 停止报文接收轮询
   */
  public stopPolling(): void {
    if (!this.isPolling) {
      return;
    }

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.isPolling = false;
    this.logger.info('报文接收轮询已停止');
  }

  /**
   * 检查是否正在轮询
   */
  public isActive(): boolean {
    return this.isPolling;
  }

  /**
   * 轮询接收报文
   */
  private pollMessages(
    device: any,
    channelHandles: Map<number, number>,
    isCanFD: Map<number, boolean>
  ): void {
    if (!device) {
      return;
    }

    try {
      for (const [projectChannelIndex, channelHandle] of channelHandles.entries()) {
        const isFD = isCanFD.get(projectChannelIndex) || false;

        try {
          let frames: any[];

          if (isFD) {
            // 接收CAN-FD报文
            frames = device.receiveFD(
              channelHandle,
              RECEIVE_POLLING.MAX_FRAMES,
              RECEIVE_POLLING.INTERVAL_MS
            );
          } else {
            // 接收标准CAN报文
            frames = device.receive(
              channelHandle,
              RECEIVE_POLLING.MAX_FRAMES,
              RECEIVE_POLLING.INTERVAL_MS
            );
          }

          if (frames && frames.length > 0) {
            for (const frame of frames) {
              this.processReceivedFrame(frame, projectChannelIndex, isFD);
            }
          }
        } catch (error: any) {
          this.logger.error(`接收通道 ${projectChannelIndex} 报文失败: ${error.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`轮询报文失败: ${error.message}`);
    }
  }

  /**
   * 处理接收到的帧
   */
  private processReceivedFrame(
    frame: ReceivedFrame | ReceivedFDFrame,
    channelIndex: number,
    isFD: boolean
  ): void {
    const message: ReceivedCanMessage = {
      timestamp: frame.timestamp || Date.now(),
      channel: channelIndex,
      id: frame.id,
      dlc: isFD ? (frame as ReceivedFDFrame).len : (frame as ReceivedFrame).dlc,
      data: frame.data,
      isFD,
    };

    // 触发接收事件
    this._onMessageReceived.fire(message);
  }
}
