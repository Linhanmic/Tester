/**
 * 设备管理器
 * 负责CAN设备的打开、关闭、通道初始化等操作
 */

import { ChannelConfig } from '../../types/parser.types';
import { CanChannelConfig } from '../../types/device.types';
import { Logger } from '../../utils/logger';

/**
 * 设备配置哈希
 */
export interface DeviceConfigHash {
  deviceId: number;
  deviceIndex: number;
  channels: string;
}

/**
 * 设备管理器
 */
export class DeviceManager {
  private device: any = null;
  private zlgcanModule: any = null;
  private deviceInitialized: boolean = false;
  private currentConfigHash: string = "";

  // 通道管理
  private channelHandles: Map<number, number> = new Map();
  private channelConfigs: ChannelConfig[] = [];
  private isCanFD: Map<number, boolean> = new Map();
  private channelIndexMap: Map<number, number> = new Map();

  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 检查设备是否已初始化
   */
  public isInitialized(): boolean {
    return this.deviceInitialized;
  }

  /**
   * 获取设备实例
   */
  public getDevice(): any {
    return this.device;
  }

  /**
   * 获取通道句柄
   */
  public getChannelHandle(projectChannelIndex: number): number | undefined {
    return this.channelHandles.get(projectChannelIndex);
  }

  /**
   * 获取所有通道句柄
   */
  public getAllChannelHandles(): Map<number, number> {
    return this.channelHandles;
  }

  /**
   * 获取通道配置
   */
  public getChannelConfigs(): ChannelConfig[] {
    return this.channelConfigs;
  }

  /**
   * 检查通道是否为CAN-FD
   */
  public isChannelFD(projectChannelIndex: number): boolean {
    return this.isCanFD.get(projectChannelIndex) || false;
  }

  /**
   * 获取通道索引映射
   */
  public getChannelIndexMap(): Map<number, number> {
    return this.channelIndexMap;
  }

  /**
   * 打开设备并初始化通道
   */
  public async openDevice(config: ChannelConfig[]): Promise<{ success: boolean; message: string }> {
    try {
      // 加载ZLGCAN模块
      if (!this.zlgcanModule) {
        const path = require('path');
        const zlgcanPath = path.join(__dirname, '../../../zlgcan');
        this.zlgcanModule = require(zlgcanPath);
        this.logger.info('ZLGCAN模块已加载');
      }

      // 计算配置哈希
      const configHash = this.getConfigHash(config);

      // 如果配置相同且设备已初始化，复用现有设备
      if (this.deviceInitialized && this.currentConfigHash === configHash) {
        this.logger.info('使用现有设备连接');
        return { success: true, message: '设备已连接（复用）' };
      }

      // 关闭旧设备
      if (this.deviceInitialized) {
        this.logger.info('关闭旧设备...');
        this.closeDevice();
      }

      // 打开新设备
      const firstChannel = config[0];
      this.device = new this.zlgcanModule.ZLGCAN();
      const opened = this.device.openDevice(
        firstChannel.deviceId,
        firstChannel.deviceIndex,
        0
      );

      if (!opened) {
        throw new Error('无法打开设备');
      }

      this.logger.info(`设备已打开: 类型=${firstChannel.deviceId}, 索引=${firstChannel.deviceIndex}`);

      // 初始化所有通道
      for (const channelConfig of config) {
        const result = await this.initChannel(channelConfig);
        if (!result.success) {
          throw new Error(result.message);
        }
      }

      // 标记设备已初始化
      this.deviceInitialized = true;
      this.currentConfigHash = configHash;
      this.channelConfigs = config;

      return {
        success: true,
        message: `设备已打开，初始化了 ${config.length} 个通道`
      };

    } catch (error: any) {
      this.logger.error('打开设备失败', error);
      this.closeDevice();
      return {
        success: false,
        message: `打开设备失败: ${error.message}`
      };
    }
  }

  /**
   * 初始化单个通道
   */
  private async initChannel(config: ChannelConfig): Promise<{ success: boolean; message: string }> {
    try {
      const isFD = config.dataBaudrate !== undefined;
      this.isCanFD.set(config.projectChannelIndex, isFD);

      let channelHandle: number;

      if (isFD) {
        // CAN-FD模式
        const canfdConfig: CanChannelConfig = {
          canType: 4, // CAN-FD
          abitTiming: config.arbitrationBaudrate,
          dbitTiming: config.dataBaudrate,
        };

        channelHandle = this.device.initCANFD(config.channelIndex, canfdConfig);
        this.logger.info(
          `通道 ${config.channelIndex} (项目索引 ${config.projectChannelIndex}) 初始化为 CAN-FD: ` +
          `仲裁=${config.arbitrationBaudrate}, 数据=${config.dataBaudrate}`
        );
      } else {
        // 标准CAN模式
        const baudrate = this.convertBaudrate(config.arbitrationBaudrate);
        const canConfig: CanChannelConfig = {
          canType: 0,
          timing0: baudrate.timing0,
          timing1: baudrate.timing1,
          filter: 0,
        };

        channelHandle = this.device.initCAN(config.channelIndex, canConfig);
        this.logger.info(
          `通道 ${config.channelIndex} (项目索引 ${config.projectChannelIndex}) 初始化为 CAN: ` +
          `波特率=${config.arbitrationBaudrate}`
        );
      }

      if (channelHandle < 0) {
        throw new Error(`通道 ${config.channelIndex} 初始化失败`);
      }

      // 启动通道
      const started = this.device.startCAN(channelHandle);
      if (!started) {
        throw new Error(`通道 ${config.channelIndex} 启动失败`);
      }

      // 保存通道句柄和映射
      this.channelHandles.set(config.projectChannelIndex, channelHandle);
      this.channelIndexMap.set(config.projectChannelIndex, config.channelIndex);

      return { success: true, message: '通道初始化成功' };

    } catch (error: any) {
      this.logger.error(`初始化通道失败: ${config.channelIndex}`, error);
      return {
        success: false,
        message: `初始化通道 ${config.channelIndex} 失败: ${error.message}`
      };
    }
  }

  /**
   * 关闭设备
   */
  public closeDevice(): void {
    if (!this.deviceInitialized || !this.device) {
      return;
    }

    try {
      // 重置通道
      for (const channelHandle of this.channelHandles.values()) {
        try {
          this.device.resetCAN(channelHandle);
        } catch (error) {
          this.logger.error('重置通道失败', error);
        }
      }

      // 关闭设备
      this.device.closeDevice();
      this.logger.info('设备已关闭');

    } catch (error) {
      this.logger.error('关闭设备时出错', error);
    } finally {
      // 清理状态
      this.device = null;
      this.deviceInitialized = false;
      this.currentConfigHash = "";
      this.channelHandles.clear();
      this.channelConfigs = [];
      this.isCanFD.clear();
      this.channelIndexMap.clear();
    }
  }

  /**
   * 转换波特率为timing0和timing1
   */
  private convertBaudrate(baudrate: number): { timing0: number; timing1: number } {
    const baudrateMap: { [key: number]: { timing0: number; timing1: number } } = {
      1000000: { timing0: 0x00, timing1: 0x14 },
      800000: { timing0: 0x00, timing1: 0x16 },
      500000: { timing0: 0x00, timing1: 0x1c },
      250000: { timing0: 0x01, timing1: 0x1c },
      125000: { timing0: 0x03, timing1: 0x1c },
      100000: { timing0: 0x04, timing1: 0x1c },
      50000: { timing0: 0x09, timing1: 0x1c },
      20000: { timing0: 0x18, timing1: 0x1c },
      10000: { timing0: 0x31, timing1: 0x1c },
    };

    const result = baudrateMap[baudrate];
    if (!result) {
      this.logger.warn(`未知波特率 ${baudrate}，使用默认值 500000`);
      return baudrateMap[500000];
    }

    return result;
  }

  /**
   * 计算配置哈希值
   */
  private getConfigHash(config: ChannelConfig[]): string {
    const configData = config.map(c => ({
      deviceId: c.deviceId,
      deviceIndex: c.deviceIndex,
      channelIndex: c.channelIndex,
      arbitrationBaudrate: c.arbitrationBaudrate,
      dataBaudrate: c.dataBaudrate,
    }));
    return JSON.stringify(configData);
  }
}
