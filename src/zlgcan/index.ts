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
    ZCAN_PCI5121: 1,
    ZCAN_PCI9810: 2,
    ZCAN_USBCAN1: 3,
    ZCAN_USBCAN2: 4,
    ZCAN_PCI9820: 5,
    ZCAN_CAN232: 6,
    ZCAN_PCI5110: 7,
    ZCAN_CANLITE: 8,
    ZCAN_ISA9620: 9,
    ZCAN_ISA5420: 10,
    ZCAN_PC104CAN: 11,
    ZCAN_CANETUDP: 12,
    ZCAN_CANETE: 12,
    ZCAN_DNP9810: 13,
    ZCAN_PCI9840: 14,
    ZCAN_PC104CAN2: 15,
    ZCAN_PCI9820I: 16,
    ZCAN_CANETTCP: 17,
    ZCAN_PCIE_9220: 18,
    ZCAN_PCI5010U: 19,
    ZCAN_USBCAN_E_U: 20,
    ZCAN_USBCAN_2E_U: 21,
    ZCAN_PCI5020U: 22,
    ZCAN_EG20T_CAN: 23,
    ZCAN_PCIE9221: 24,
    ZCAN_WIFICAN_TCP: 25,
    ZCAN_WIFICAN_UDP: 26,
    ZCAN_PCIe9120: 27,
    ZCAN_PCIe9110: 28,
    ZCAN_PCIe9140: 29,
    ZCAN_USBCAN_4E_U: 31,
    ZCAN_CANDTU_200UR: 32,
    ZCAN_CANDTU_MINI: 33,
    ZCAN_USBCAN_8E_U: 34,
    ZCAN_CANREPLAY: 35,
    ZCAN_CANDTU_NET: 36,
    ZCAN_CANDTU_100UR: 37,
    ZCAN_PCIE_CANFD_100U: 38,
    ZCAN_PCIE_CANFD_200U: 39,
    ZCAN_PCIE_CANFD_400U: 40,
    ZCAN_USBCANFD_200U: 41,
    ZCAN_USBCANFD_100U: 42,
    ZCAN_USBCANFD_MINI: 43,
    ZCAN_CANFDCOM_100IE: 44,
    ZCAN_CANSCOPE: 45,
    ZCAN_CLOUD: 46,
    ZCAN_CANDTU_NET_400: 47,
    ZCAN_CANFDNET_TCP: 48,
    ZCAN_CANFDNET_200U_TCP: 48,
    ZCAN_CANFDNET_UDP: 49,
    ZCAN_CANFDNET_200U_UDP: 49,
    ZCAN_CANFDWIFI_TCP: 50,
    ZCAN_CANFDWIFI_100U_TCP: 50,
    ZCAN_CANFDWIFI_UDP: 51,
    ZCAN_CANFDWIFI_100U_UDP: 51,
    ZCAN_CANFDNET_400U_TCP: 52,
    ZCAN_CANFDNET_400U_UDP: 53,
    ZCAN_CANFDBLUE_200U: 54,
    ZCAN_CANFDNET_100U_TCP: 55,
    ZCAN_CANFDNET_100U_UDP: 56,
    ZCAN_CANFDNET_800U_TCP: 57,
    ZCAN_CANFDNET_800U_UDP: 58,
    ZCAN_USBCANFD_800U: 59,
    ZCAN_PCIE_CANFD_100U_EX: 60,
    ZCAN_PCIE_CANFD_400U_EX: 61,
    ZCAN_PCIE_CANFD_200U_MINI: 62,
    ZCAN_PCIE_CANFD_200U_EX: 63,
    ZCAN_PCIE_CANFD_200U_M2: 63,
    ZCAN_CANFDDTU_400_TCP: 64,
    ZCAN_CANFDDTU_400_UDP: 65,
    ZCAN_CANFDWIFI_200U_TCP: 66,
    ZCAN_CANFDWIFI_200U_UDP: 67,
    ZCAN_CANFDDTU_800ER_TCP: 68,
    ZCAN_CANFDDTU_800ER_UDP: 69,
    ZCAN_CANFDDTU_800EWGR_TCP: 70,
    ZCAN_CANFDDTU_800EWGR_UDP: 71,
    ZCAN_CANFDDTU_600EWGR_TCP: 72,
    ZCAN_CANFDDTU_600EWGR_UDP: 73,
    ZCAN_CANFDDTU_CASCADE_TCP: 74,
    ZCAN_CANFDDTU_CASCADE_UDP: 75,
    ZCAN_USBCANFD_400U: 76,
    ZCAN_CANFDDTU_200U: 77,
    ZCAN_ZPSCANFD_TCP: 78,
    ZCAN_ZPSCANFD_USB: 79,
    ZCAN_CANFDBRIDGE_PLUS: 80,
    ZCAN_CANFDDTU_300U: 81,
    ZCAN_PCIE_CANFD_800U: 82,
    ZCAN_PCIE_CANFD_1200U: 83,
    ZCAN_MINI_PCIE_CANFD: 84,
    ZCAN_USBCANFD_800H: 85,
    ZCAN_BG002: 86,
    ZCAN_BG004: 87,
    ZCAN_OFFLINE_DEVICE: 98,
    ZCAN_VIRTUAL_DEVICE: 99,
} as const;

// CAN类型常量
export const CanType = {
    TYPE_CAN: 0,
    TYPE_CANFD: 1,
    TYPE_ALL_DATA: 2,
} as const;

// CAN帧接口
export interface CanFrame {
    id: number;
    dlc: number;
    data: number[];
    transmitType?: number;
}

// CANFD帧接口
export interface CanFDFrame {
    id: number;
    len: number;
    data: number[];
    flags?: number;
    transmitType?: number;
}

// 接收帧接口
export interface ReceivedFrame {
    id: number;
    dlc: number;
    data: number[];
    timestamp: number;
}

// CANFD接收帧接口
export interface ReceivedFDFrame {
    id: number;
    len: number;
    data: number[];
    flags: number;
    timestamp: number;
}

// CANFD接收回调函数类型
export type ReceiveFDCallback = (frames: ReceivedFDFrame[]) => void;

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
     * 发送CANFD帧
     * @param channelHandle 通道句柄
     * @param frame CANFD帧
     */
    transmitFD(channelHandle: number, frame: CanFDFrame): number {
        const fullFrame = {
            id: frame.id,
            len: frame.len,
            data: frame.data,
            flags: frame.flags ?? 0,
            transmitType: frame.transmitType ?? 0,
        };
        return this.device.transmitFD(channelHandle, fullFrame);
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
     * 接收CANFD帧
     * @param channelHandle 通道句柄
     * @param count 最大接收数量
     * @param waitTime 等待时间（毫秒），-1表示阻塞等待
     */
    receiveFD(channelHandle: number, count: number, waitTime: number = -1): ReceivedFDFrame[] {
        return this.device.receiveFD(channelHandle, count, waitTime);
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
