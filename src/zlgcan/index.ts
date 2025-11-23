import * as path from 'path';
import * as process from 'process';

// 获取lib目录的绝对路径
const libDir = path.resolve(__dirname, 'lib');

// 设置动态链接库搜索路径
if (process.platform === 'win32') {
    // Windows: 将lib目录添加到PATH环境变量
    const currentPath = process.env.PATH || '';
    if (!currentPath.includes(libDir)) {
        process.env.PATH = `${libDir};${currentPath}`;
    }
}

// 加载zlgcan.node
const zlgcanPath = path.join(libDir, 'zlgcan.node');
const zlgcan = require(zlgcanPath);

// 设备类型常量
export const DeviceType = {
    ZCAN_USBCAN1: 3,
    ZCAN_USBCAN2: 4,
    ZCAN_USBCAN_E_U: 20,
    ZCAN_USBCAN_2E_U: 21,
    ZCAN_USBCANFD_200U: 33,
    ZCAN_USBCANFD_100U: 34,
    ZCAN_USBCANFD_MINI: 35,
} as const;

// CAN类型常量
export const CanType = {
    TYPE_CAN: 0,
    TYPE_CANFD: 1,
} as const;

// CAN帧接口
export interface CanFrame {
    id: number;
    dlc: number;
    data: number[];
    transmitType?: number;
}

// 接收帧接口
export interface ReceivedFrame {
    id: number;
    dlc: number;
    data: number[];
    timestamp: number;
}

// CAN通道配置接口
export interface CanChannelConfig {
    canType: number;
    accCode?: number;
    accMask?: number;
    reserved?: number;
    filter?: number;
    timing0?: number;
    timing1?: number;
    mode?: number;
    // CANFD配置
    abitTiming?: number;
    dbitTiming?: number;
    brp?: number;
    pad?: number;
}

// 设备信息接口
export interface DeviceInfo {
    hardwareVersion: number;
    firmwareVersion: number;
    driverVersion: number;
    libraryVersion: number;
    irqNumber: number;
    canNumber: number;
    serialNumber: string;
    hardwareType: string;
}

// 接收回调函数类型
export type ReceiveCallback = (frames: ReceivedFrame[]) => void;

/**
 * ZLG CAN设备封装类
 */
export class ZlgCanDevice {
    private device: any;

    constructor() {
        this.device = new zlgcan.ZlgCanDevice();
    }

    /**
     * 打开设备
     * @param deviceType 设备类型
     * @param deviceIndex 设备索引
     * @param reserved 保留参数
     */
    openDevice(deviceType: number, deviceIndex: number, reserved: number = 0): boolean {
        return this.device.openDevice(deviceType, deviceIndex, reserved);
    }

    /**
     * 关闭设备
     */
    closeDevice(): boolean {
        return this.device.closeDevice();
    }

    /**
     * 获取设备信息
     */
    getDeviceInfo(): DeviceInfo {
        return this.device.getDeviceInfo();
    }

    /**
     * 初始化CAN通道
     * @param channelIndex 通道索引
     * @param config 通道配置
     */
    initCanChannel(channelIndex: number, config: CanChannelConfig): number {
        const fullConfig = {
            canType: config.canType,
            accCode: config.accCode ?? 0,
            accMask: config.accMask ?? 0xFFFFFFFF,
            reserved: config.reserved ?? 0,
            filter: config.filter ?? 0,
            timing0: config.timing0 ?? 0,
            timing1: config.timing1 ?? 0x1C,
            mode: config.mode ?? 0,
            abitTiming: config.abitTiming ?? 0,
            dbitTiming: config.dbitTiming ?? 0,
            brp: config.brp ?? 0,
            pad: config.pad ?? 0,
        };
        return this.device.initCanChannel(channelIndex, fullConfig);
    }

    /**
     * 启动CAN通道
     * @param channelHandle 通道句柄
     */
    startCanChannel(channelHandle: number): boolean {
        return this.device.startCanChannel(channelHandle);
    }

    /**
     * 发送CAN帧
     * @param channelHandle 通道句柄
     * @param frame CAN帧
     */
    transmit(channelHandle: number, frame: CanFrame): number {
        const fullFrame = {
            id: frame.id,
            dlc: frame.dlc,
            data: frame.data,
            transmitType: frame.transmitType ?? 0,
        };
        return this.device.transmit(channelHandle, fullFrame);
    }

    /**
     * 接收CAN帧
     * @param channelHandle 通道句柄
     * @param count 最大接收数量
     * @param waitTime 等待时间（毫秒），-1表示阻塞等待
     */
    receive(channelHandle: number, count: number, waitTime: number = -1): ReceivedFrame[] {
        return this.device.receive(channelHandle, count, waitTime);
    }

    /**
     * 设置接收回调
     * @param channelHandle 通道句柄
     * @param callback 回调函数
     */
    setReceiveCallback(channelHandle: number, callback: ReceiveCallback): boolean {
        return this.device.setReceiveCallback(channelHandle, callback);
    }

    /**
     * 清除接收回调
     * @param channelHandle 通道句柄
     */
    clearReceiveCallback(channelHandle: number): boolean {
        return this.device.clearReceiveCallback(channelHandle);
    }
}

// 导出默认的ZlgCanDevice类
export default ZlgCanDevice;
