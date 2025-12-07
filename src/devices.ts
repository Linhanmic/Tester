/**
 * CAN设备抽象层
 * 提供统一的CAN设备接口，适配不同厂商的CAN设备
 */

import * as zlgcan from './zlgcan';

// ============== 错误码定义 ==============

/**
 * CAN设备错误码
 */
export enum ErrorCode {
  /** 设备未打开 */
  DEVICE_NOT_OPEN = 'DEVICE_NOT_OPEN',
  /** 设备已打开 */
  DEVICE_ALREADY_OPEN = 'DEVICE_ALREADY_OPEN',
  /** 通道初始化失败 */
  CHANNEL_INIT_FAILED = 'CHANNEL_INIT_FAILED',
  /** 通道启动失败 */
  CHANNEL_START_FAILED = 'CHANNEL_START_FAILED',
  /** 发送失败 */
  TRANSMIT_FAILED = 'TRANSMIT_FAILED',
  /** 接收超时 */
  RECEIVE_TIMEOUT = 'RECEIVE_TIMEOUT',
  /** 缓冲区溢出 */
  BUFFER_OVERFLOW = 'BUFFER_OVERFLOW',
  /** 总线错误 */
  BUS_ERROR = 'BUS_ERROR',
  /** 设备不存在 */
  DEVICE_NOT_EXIST = 'DEVICE_NOT_EXIST',
  /** 无效参数 */
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  /** 未知错误 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * CAN设备错误类
 */
export class CanDeviceError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CanDeviceError';
  }
}

// ============== 枚举定义 ==============

/**
 * CAN协议类型
 */
export enum CanProtocolType {
  /** 标准CAN 2.0 */
  CAN = 'CAN',
  /** CAN FD */
  CANFD = 'CANFD',
}

/**
 * CAN设备状态
 */
export enum CanDeviceState {
  /** 未连接 */
  Disconnected = 'Disconnected',
  /** 已连接 */
  Connected = 'Connected',
  /** 错误 */
  Error = 'Error',
}

// ============== 接口定义 ==============

/**
 * CAN帧接口
 */
export interface ICanFrame {
  /** 帧ID */
  id: number;
  /** 数据长度码 (0-8) */
  dlc: number;
  /** 数据内容 */
  data: number[];
  /** 发送类型 (可选) */
  transmitType?: number;
}

/**
 * CAN FD帧接口
 */
export interface ICanFDFrame {
  /** 帧ID */
  id: number;
  /** 数据长度 (0-64) */
  length: number;
  /** 数据内容 */
  data: number[];
  /** CANFD标志 (BRS, ESI) */
  flags?: number;
  /** 发送类型 (可选) */
  transmitType?: number;
}

/**
 * 接收的CAN帧接口
 */
export interface IReceivedFrame {
  /** 帧ID */
  id: number;
  /** 数据长度码 */
  dlc: number;
  /** 数据内容 */
  data: number[];
  /** 时间戳 (微秒) */
  timestamp: number;
}

/**
 * 接收的CAN FD帧接口
 */
export interface IReceivedFDFrame {
  /** 帧ID */
  id: number;
  /** 数据长度 */
  length: number;
  /** 数据内容 */
  data: number[];
  /** CANFD标志 */
  flags: number;
  /** 时间戳 (微秒) */
  timestamp: number;
}

/**
 * 通道配置接口
 */
export interface IChannelConfig {
  /** 协议类型 */
  protocolType: CanProtocolType;
  /** 仲裁段波特率 (kbps) */
  arbitrationBaudrate: number;
  /** 数据段波特率 (kbps, CANFD专用) */
  dataBaudrate?: number;
  /** 终端电阻使能 */
  terminalResistorEnabled?: boolean;
  /** 工作模式 (0:正常, 1:只听) */
  mode?: number;
}

/**
 * CAN通道接口
 */
export interface ICanChannel {
  /** 通道索引 */
  readonly channelIndex: number;

  /** 通道是否运行中 */
  readonly isRunning: boolean;

  /**
   * 启动通道
   */
  start(): Promise<void>;

  /**
   * 停止通道
   */
  stop(): Promise<void>;

  /**
   * 复位通道
   */
  reset(): Promise<void>;

  /**
   * 发送CAN帧
   * @param frame CAN帧
   */
  transmit(frame: ICanFrame): Promise<void>;

  /**
   * 发送CAN FD帧
   * @param frame CAN FD帧
   */
  transmitFD(frame: ICanFDFrame): Promise<void>;

  /**
   * 接收CAN帧
   * @param count 最大接收数量
   * @param waitTime 等待时间(ms)
   */
  receive(count: number, waitTime: number): Promise<IReceivedFrame[]>;

  /**
   * 接收CAN FD帧
   * @param count 最大接收数量
   * @param waitTime 等待时间(ms)
   */
  receiveFD(count: number, waitTime: number): Promise<IReceivedFDFrame[]>;

  /**
   * 关闭通道
   */
  close(): Promise<void>;
}

/**
 * CAN设备接口
 */
export interface ICanDevice {
  /** 设备状态 */
  readonly state: CanDeviceState;

  /** 设备类型 */
  readonly deviceType: number;

  /** 设备索引 */
  readonly deviceIndex: number;

  /**
   * 打开设备
   * @param deviceIndex 设备索引
   */
  open(deviceIndex: number): Promise<boolean>;

  /**
   * 初始化通道
   * @param channelIndex 通道索引
   * @param config 通道配置
   */
  initChannel(channelIndex: number, config: IChannelConfig): Promise<ICanChannel>;

  /**
   * 关闭设备
   */
  close(): void;

  /**
   * 检查设备是否在线
   */
  isOnline(): boolean;
}

/**
 * CAN驱动接口
 */
export interface ICanDriver {
  /** 驱动名称 */
  readonly name: string;

  /** 支持的设备类型列表 */
  readonly supportedDeviceTypes: number[];

  /**
   * 初始化驱动
   */
  initialize(): Promise<void>;

  /**
   * 创建设备实例
   * @param deviceType 设备类型
   */
  createDevice(deviceType: number): ICanDevice;

  /**
   * 释放驱动资源
   */
  dispose(): void;
}

// ============== ZLG CAN 实现 ==============

/**
 * 波特率转换工具
 */
class BaudrateConverter {
  /**
   * 将波特率(kbps)转换为timing参数
   */
  static toBaudrateTiming(baudRateKbps: number): { timing0: number; timing1: number } {
    const baudRateMap: Record<number, { timing0: number; timing1: number }> = {
      1000: { timing0: 0x00, timing1: 0x14 },
      800: { timing0: 0x00, timing1: 0x16 },
      500: { timing0: 0x00, timing1: 0x1C },
      250: { timing0: 0x01, timing1: 0x1C },
      125: { timing0: 0x03, timing1: 0x1C },
      100: { timing0: 0x04, timing1: 0x1C },
      50: { timing0: 0x09, timing1: 0x1C },
      20: { timing0: 0x18, timing1: 0x1C },
      10: { timing0: 0x31, timing1: 0x1C },
      5: { timing0: 0x3F, timing1: 0x7F },
    };

    return baudRateMap[baudRateKbps] || { timing0: 0x00, timing1: 0x1C }; // 默认500kbps
  }

  /**
   * 将波特率(kbps)转换为CANFD timing参数
   */
  static toCanFDTiming(arbitrationKbps: number, dataKbps?: number): { abitTiming: number; dbitTiming: number } {
    // CANFD timing 参数映射表
    const arbitrationMap: Record<number, number> = {
      1000: 0x00060313, // 1Mbps
      500: 0x00060707,  // 500kbps
      250: 0x00060F0F,  // 250kbps
      125: 0x00061F1F,  // 125kbps
    };

    const dataMap: Record<number, number> = {
      5000: 0x00000101, // 5Mbps
      4000: 0x00000102, // 4Mbps
      2000: 0x00000305, // 2Mbps
      1000: 0x00000707, // 1Mbps
      500: 0x00000F0F,  // 500kbps
    };

    const abitTiming = arbitrationMap[arbitrationKbps] || 0x00060707; // 默认500kbps
    const dbitTiming = dataKbps ? (dataMap[dataKbps] || 0x00000305) : abitTiming; // 默认2Mbps

    return { abitTiming, dbitTiming };
  }
}

/**
 * ZLG CAN通道实现
 */
class ZlgCanChannel implements ICanChannel {
  private _isRunning = false;

  constructor(
    public readonly channelIndex: number,
    private readonly handle: zlgcan.ChannelHandle,
    private readonly device: zlgcan.ZlgCanDevice
  ) {}

  get isRunning(): boolean {
    return this._isRunning;
  }

  async start(): Promise<void> {
    if (this._isRunning) {
      return;
    }

    const success = this.device.startCanChannel(this.handle);
    if (!success) {
      throw new CanDeviceError(
        ErrorCode.CHANNEL_START_FAILED,
        `通道 ${this.channelIndex} 启动失败`
      );
    }

    this._isRunning = true;
  }

  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    // ZLG设备没有显式的stop方法，使用reset代替
    await this.reset();
    this._isRunning = false;
  }

  async reset(): Promise<void> {
    const success = this.device.resetCanChannel(this.handle);
    if (!success) {
      throw new CanDeviceError(
        ErrorCode.BUS_ERROR,
        `通道 ${this.channelIndex} 复位失败`
      );
    }
  }

  async transmit(frame: ICanFrame): Promise<void> {
    const zlgFrame: zlgcan.CanFrame = {
      id: frame.id,
      dlc: frame.dlc,
      data: frame.data,
      transmitType: frame.transmitType,
    };

    const sent = this.device.transmit(this.handle, zlgFrame);
    if (sent === 0) {
      throw new CanDeviceError(
        ErrorCode.TRANSMIT_FAILED,
        `发送CAN帧失败 (ID: 0x${frame.id.toString(16)})`
      );
    }
  }

  async transmitFD(frame: ICanFDFrame): Promise<void> {
    const zlgFrame: zlgcan.CanFDFrame = {
      id: frame.id,
      len: frame.length,
      data: frame.data,
      flags: frame.flags,
      transmitType: frame.transmitType,
    };

    const sent = this.device.transmitFD(this.handle, zlgFrame);
    if (sent === 0) {
      throw new CanDeviceError(
        ErrorCode.TRANSMIT_FAILED,
        `发送CANFD帧失败 (ID: 0x${frame.id.toString(16)})`
      );
    }
  }

  async receive(count: number, waitTime: number): Promise<IReceivedFrame[]> {
    try {
      const frames = this.device.receive(this.handle, count, waitTime);
      return frames.map(f => ({
        id: f.id,
        dlc: f.dlc,
        data: f.data,
        timestamp: f.timestamp,
      }));
    } catch (error: any) {
      throw new CanDeviceError(
        ErrorCode.RECEIVE_TIMEOUT,
        `接收CAN帧失败: ${error.message}`
      );
    }
  }

  async receiveFD(count: number, waitTime: number): Promise<IReceivedFDFrame[]> {
    try {
      const frames = this.device.receiveFD(this.handle, count, waitTime);
      return frames.map(f => ({
        id: f.id,
        length: f.len,
        data: f.data,
        flags: f.flags,
        timestamp: f.timestamp,
      }));
    } catch (error: any) {
      throw new CanDeviceError(
        ErrorCode.RECEIVE_TIMEOUT,
        `接收CANFD帧失败: ${error.message}`
      );
    }
  }

  async close(): Promise<void> {
    // ZLG通道句柄在设备关闭时自动释放
    this._isRunning = false;
  }
}

/**
 * ZLG CAN设备实现
 */
class ZlgCanDevice implements ICanDevice {
  private _state: CanDeviceState = CanDeviceState.Disconnected;
  private _deviceIndex = 0;
  private zlgDevice: zlgcan.ZlgCanDevice;
  private channels: Map<number, ZlgCanChannel> = new Map();
  private _deviceType: zlgcan.DeviceTypeValue;

  constructor(public readonly deviceType: number) {
    this.zlgDevice = new zlgcan.ZlgCanDevice();
    this._deviceType = deviceType as zlgcan.DeviceTypeValue;
  }

  get state(): CanDeviceState {
    return this._state;
  }

  get deviceIndex(): number {
    return this._deviceIndex;
  }

  async open(deviceIndex: number): Promise<boolean> {
    if (this._state === CanDeviceState.Connected) {
      throw new CanDeviceError(
        ErrorCode.DEVICE_ALREADY_OPEN,
        '设备已打开'
      );
    }

    const success = this.zlgDevice.openDevice(this._deviceType, deviceIndex, 0);
    if (!success) {
      this._state = CanDeviceState.Error;
      return false;
    }

    this._deviceIndex = deviceIndex;
    this._state = CanDeviceState.Connected;
    return true;
  }

  async initChannel(channelIndex: number, config: IChannelConfig): Promise<ICanChannel> {
    if (this._state !== CanDeviceState.Connected) {
      throw new CanDeviceError(
        ErrorCode.DEVICE_NOT_OPEN,
        '设备未打开，无法初始化通道'
      );
    }

    // 构建ZLG通道配置
    const zlgConfig: zlgcan.CanChannelConfig = {
      canType: config.protocolType === CanProtocolType.CANFD
        ? zlgcan.CanType.TYPE_CANFD
        : zlgcan.CanType.TYPE_CAN,
      mode: config.mode ?? 0,
    };

    // 设置波特率
    if (config.protocolType === CanProtocolType.CANFD) {
      // CANFD模式
      const timing = BaudrateConverter.toCanFDTiming(
        config.arbitrationBaudrate,
        config.dataBaudrate
      );
      zlgConfig.abitTiming = timing.abitTiming;
      zlgConfig.dbitTiming = timing.dbitTiming;
    } else {
      // CAN模式
      const timing = BaudrateConverter.toBaudrateTiming(config.arbitrationBaudrate);
      zlgConfig.timing0 = timing.timing0;
      zlgConfig.timing1 = timing.timing1;
    }

    // 初始化通道
    const handle = this.zlgDevice.initCanChannel(channelIndex, zlgConfig);
    if (handle === zlgcan.INVALID_CHANNEL_HANDLE) {
      throw new CanDeviceError(
        ErrorCode.CHANNEL_INIT_FAILED,
        `通道 ${channelIndex} 初始化失败`
      );
    }

    // 创建通道对象
    const channel = new ZlgCanChannel(channelIndex, handle, this.zlgDevice);
    this.channels.set(channelIndex, channel);

    return channel;
  }

  close(): void {
    // 关闭所有通道
    for (const channel of this.channels.values()) {
      channel.close();
    }
    this.channels.clear();

    // 关闭设备
    if (this._state === CanDeviceState.Connected) {
      this.zlgDevice.closeDevice();
      this._state = CanDeviceState.Disconnected;
    }
  }

  isOnline(): boolean {
    if (this._state !== CanDeviceState.Connected) {
      return false;
    }
    return this.zlgDevice.isDeviceOnLine();
  }
}

/**
 * ZLG CAN驱动
 */
export class ZlgCanDriver implements ICanDriver {
  readonly name = 'zlgcan';
  readonly supportedDeviceTypes: number[];

  constructor() {
    // 从zlgcan模块获取所有支持的设备类型
    this.supportedDeviceTypes = Object.values(zlgcan.DeviceType);
  }

  async initialize(): Promise<void> {
    // ZLG驱动初始化（如果需要）
    // 当前zlgcan模块不需要显式初始化
  }

  createDevice(deviceType: number): ICanDevice {
    if (!this.supportedDeviceTypes.includes(deviceType)) {
      throw new CanDeviceError(
        ErrorCode.INVALID_PARAMETER,
        `不支持的设备类型: ${deviceType}`
      );
    }
    return new ZlgCanDevice(deviceType);
  }

  dispose(): void {
    // 释放驱动资源（如果需要）
  }
}

// ============== 设备管理器 ==============

/**
 * CAN设备管理器（单例）
 */
export class CanDeviceManager {
  private static instance: CanDeviceManager;
  private drivers: Map<string, ICanDriver> = new Map();
  private devices: ICanDevice[] = [];

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): CanDeviceManager {
    if (!CanDeviceManager.instance) {
      CanDeviceManager.instance = new CanDeviceManager();
    }
    return CanDeviceManager.instance;
  }

  /**
   * 注册驱动
   */
  registerDriver(driver: ICanDriver): void {
    this.drivers.set(driver.name, driver);
  }

  /**
   * 获取驱动
   */
  getDriver(name: string): ICanDriver | undefined {
    return this.drivers.get(name);
  }

  /**
   * 通过厂商代码创建设备
   */
  createDeviceByVendorCode(deviceType: number, driverName: string): ICanDevice {
    const driver = this.drivers.get(driverName);
    if (!driver) {
      throw new CanDeviceError(
        ErrorCode.DEVICE_NOT_EXIST,
        `未找到驱动: ${driverName}`
      );
    }

    const device = driver.createDevice(deviceType);
    this.devices.push(device);
    return device;
  }

  /**
   * 释放所有资源
   */
  dispose(): void {
    // 关闭所有设备
    for (const device of this.devices) {
      device.close();
    }
    this.devices = [];

    // 释放所有驱动
    for (const driver of this.drivers.values()) {
      driver.dispose();
    }
    this.drivers.clear();
  }
}
