/**
 * 设备相关类型定义
 * 包含CAN设备、通道、报文等相关类型
 */

/** CAN帧 */
export interface CanFrame {
  id: number;
  dlc: number;
  data: number[];
  transmitType?: number;
}

/** CAN-FD帧 */
export interface CanFDFrame {
  id: number;
  len: number;
  data: number[];
  flags?: number;
  transmitType?: number;
}

/** 接收的CAN帧 */
export interface ReceivedFrame {
  id: number;
  dlc: number;
  data: number[];
  timestamp: number;
}

/** 接收的CAN-FD帧 */
export interface ReceivedFDFrame {
  id: number;
  len: number;
  data: number[];
  flags: number;
  timestamp: number;
}

/** CAN通道配置 */
export interface CanChannelConfig {
  canType: number;
  accCode?: number;
  accMask?: number;
  reserved?: number;
  filter?: number;
  timing0?: number;
  timing1?: number;
  mode?: number;
  abitTiming?: number;
  dbitTiming?: number;
  brp?: number;
  pad?: number;
}

/** 设备信息 */
export interface DeviceInfo {
  connected: boolean;
  deviceType: string;
  deviceIndex: number;
  channels: ChannelInfo[];
}

/** 通道信息 */
export interface ChannelInfo {
  projectIndex: number;
  deviceIndex: number;
  baudrate: number;
  dataBaudrate?: number;
  isFD: boolean;
  running: boolean;
}

/** 接收的CAN报文 */
export interface ReceivedCanMessage {
  timestamp: number;
  channel: number;
  id: number;
  dlc: number;
  data: number[];
  isFD: boolean;
}

/** 发送的CAN报文 */
export interface SentCanMessage {
  timestamp: number;
  channel: number;
  id: number;
  dlc: number;
  data: number[];
  isFD: boolean;
}
