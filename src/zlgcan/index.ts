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

// ============== 类型定义 ==============

/** 通道句柄类型 (64位指针，使用BigInt) */
export type ChannelHandle = bigint;

/** 设备句柄类型 */
export type DeviceHandle = bigint;

// ============== 设备类型常量 ==============

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

export type DeviceTypeValue = typeof DeviceType[keyof typeof DeviceType];

// 设备类型名称映射
export const DeviceTypeNames: Record<number, string> = {
    1: 'PCI5121',
    2: 'PCI9810',
    3: 'USBCAN-I',
    4: 'USBCAN-II',
    5: 'PCI9820',
    6: 'CAN232',
    7: 'PCI5110',
    8: 'CANLITE',
    9: 'ISA9620',
    10: 'ISA5420',
    11: 'PC104CAN',
    12: 'CANETE/UDP',
    13: 'DNP9810',
    14: 'PCI9840',
    15: 'PC104CAN2',
    16: 'PCI9820I',
    17: 'CANETTCP',
    18: 'PCIE-9220',
    19: 'PCI5010U',
    20: 'USBCAN-E-U',
    21: 'USBCAN-2E-U',
    22: 'PCI5020U',
    23: 'EG20T-CAN',
    24: 'PCIE9221',
    25: 'WIFICAN-TCP',
    26: 'WIFICAN-UDP',
    27: 'PCIe9120',
    28: 'PCIe9110',
    29: 'PCIe9140',
    31: 'USBCAN-4E-U',
    32: 'CANDTU-200UR',
    33: 'CANDTU-MINI',
    34: 'USBCAN-8E-U',
    35: 'CANREPLAY',
    36: 'CANDTU-NET',
    37: 'CANDTU-100UR',
    38: 'PCIE-CANFD-100U',
    39: 'PCIE-CANFD-200U',
    40: 'PCIE-CANFD-400U',
    41: 'USBCANFD-200U',
    42: 'USBCANFD-100U',
    43: 'USBCANFD-MINI',
    44: 'CANFDCOM-100IE',
    45: 'CANSCOPE',
    46: 'CLOUD',
    47: 'CANDTU-NET-400',
    48: 'CANFDNET-200U-TCP',
    49: 'CANFDNET-200U-UDP',
    50: 'CANFDWIFI-100U-TCP',
    51: 'CANFDWIFI-100U-UDP',
    52: 'CANFDNET-400U-TCP',
    53: 'CANFDNET-400U-UDP',
    54: 'CANFDBLUE-200U',
    55: 'CANFDNET-100U-TCP',
    56: 'CANFDNET-100U-UDP',
    57: 'CANFDNET-800U-TCP',
    58: 'CANFDNET-800U-UDP',
    59: 'USBCANFD-800U',
    60: 'PCIE-CANFD-100U-EX',
    61: 'PCIE-CANFD-400U-EX',
    62: 'PCIE-CANFD-200U-MINI',
    63: 'PCIE-CANFD-200U-EX/M2',
    64: 'CANFDDTU-400-TCP',
    65: 'CANFDDTU-400-UDP',
    66: 'CANFDWIFI-200U-TCP',
    67: 'CANFDWIFI-200U-UDP',
    68: 'CANFDDTU-800ER-TCP',
    69: 'CANFDDTU-800ER-UDP',
    70: 'CANFDDTU-800EWGR-TCP',
    71: 'CANFDDTU-800EWGR-UDP',
    72: 'CANFDDTU-600EWGR-TCP',
    73: 'CANFDDTU-600EWGR-UDP',
    74: 'CANFDDTU-CASCADE-TCP',
    75: 'CANFDDTU-CASCADE-UDP',
    76: 'USBCANFD-400U',
    77: 'CANFDDTU-200U',
    78: 'ZPSCANFD-TCP',
    79: 'ZPSCANFD-USB',
    80: 'CANFDBRIDGE-PLUS',
    81: 'CANFDDTU-300U',
    82: 'PCIE-CANFD-800U',
    83: 'PCIE-CANFD-1200U',
    84: 'MINI-PCIE-CANFD',
    85: 'USBCANFD-800H',
    86: 'BG002',
    87: 'BG004',
    98: 'OFFLINE-DEVICE',
    99: 'VIRTUAL-DEVICE',
};

// ============== CAN类型常量 ==============

export const CanType = {
    /** CAN模式 */
    TYPE_CAN: 0,
    /** CANFD模式 */
    TYPE_CANFD: 1,
    /** 全部数据类型 */
    TYPE_ALL_DATA: 2,
} as const;

export type CanTypeValue = typeof CanType[keyof typeof CanType];

// ============== 数据类型常量 ==============

export const DataType = {
    /** CAN/CANFD数据 */
    ZCAN_DT_ZCAN_CAN_CANFD_DATA: 1,
    /** 错误数据 */
    ZCAN_DT_ZCAN_ERROR_DATA: 2,
    /** GPS数据 */
    ZCAN_DT_ZCAN_GPS_DATA: 3,
    /** LIN数据 */
    ZCAN_DT_ZCAN_LIN_DATA: 4,
    /** 总线使用率数据 */
    ZCAN_DT_ZCAN_BUSUSAGE_DATA: 5,
} as const;

export type DataTypeValue = typeof DataType[keyof typeof DataType];

// ============== 错误类型常量 ==============

export const ErrorType = {
    /** 无错误 */
    ZCAN_ERR_TYPE_NO_ERR: 0,
    /** 总线错误 */
    ZCAN_ERR_TYPE_BUS_ERR: 1,
    /** 控制器错误 */
    ZCAN_ERR_TYPE_CONTROLLER_ERR: 2,
    /** 设备错误 */
    ZCAN_ERR_TYPE_DEVICE_ERR: 3,
} as const;

export type ErrorTypeValue = typeof ErrorType[keyof typeof ErrorType];

// ============== 节点状态常量 ==============

export const NodeState = {
    /** 总线活动 */
    ZCAN_NODE_STATE_ACTIVE: 1,
    /** 总线告警 */
    ZCAN_NODE_STATE_WARNNING: 2,
    /** 被动错误 */
    ZCAN_NODE_STATE_PASSIVE: 3,
    /** 总线关闭 */
    ZCAN_NODE_STATE_BUSOFF: 4,
} as const;

export type NodeStateValue = typeof NodeState[keyof typeof NodeState];

// ============== CAN帧标志常量 ==============

export const CanFrameFlags = {
    /** 扩展帧标志 (29位ID) */
    CAN_EFF_FLAG: 0x80000000,
    /** 远程帧标志 */
    CAN_RTR_FLAG: 0x40000000,
    /** 错误帧标志 */
    CAN_ERR_FLAG: 0x20000000,
} as const;

// ============== CANFD帧标志常量 ==============

export const CanFDFrameFlags = {
    /** 比特率切换标志 */
    CANFD_BRS: 0x01,
    /** 错误状态指示标志 */
    CANFD_ESI: 0x02,
} as const;

// ============== 状态码常量 ==============

export const StatusCode = {
    STATUS_ERR: 0,
    STATUS_OK: 1,
    STATUS_ONLINE: 2,
    STATUS_OFFLINE: 3,
    STATUS_UNSUPPORTED: 4,
    STATUS_BUFFER_TOO_SMALL: 5,
} as const;

// ============== 无效句柄常量 ==============

export const INVALID_DEVICE_HANDLE: DeviceHandle = BigInt(0);
export const INVALID_CHANNEL_HANDLE: ChannelHandle = BigInt(0);

// ============== 错误码常量 ==============

export const ErrorCode = {
    ZCAN_ERROR_CAN_OVERFLOW: 0x0001,
    ZCAN_ERROR_CAN_ERRALARM: 0x0002,
    ZCAN_ERROR_CAN_PASSIVE: 0x0004,
    ZCAN_ERROR_CAN_LOSE: 0x0008,
    ZCAN_ERROR_CAN_BUSERR: 0x0010,
    ZCAN_ERROR_CAN_BUSOFF: 0x0020,
    ZCAN_ERROR_CAN_BUFFER_OVERFLOW: 0x0040,
    ZCAN_ERROR_DEVICEOPENED: 0x0100,
    ZCAN_ERROR_DEVICEOPEN: 0x0200,
    ZCAN_ERROR_DEVICENOTOPEN: 0x0400,
    ZCAN_ERROR_BUFFEROVERFLOW: 0x0800,
    ZCAN_ERROR_DEVICENOTEXIST: 0x1000,
    ZCAN_ERROR_LOADKERNELDLL: 0x2000,
    ZCAN_ERROR_CMDFAILED: 0x4000,
    ZCAN_ERROR_BUFFERCREATE: 0x8000,
} as const;

// ============== 接口定义 ==============

/** CAN帧接口 */
export interface CanFrame {
    /** 帧ID */
    id: number;
    /** 数据长度 (0-8) */
    dlc: number;
    /** 数据内容 */
    data: number[];
    /** 发送类型 (0:正常发送, 1:单次发送, 2:自发自收, 3:单次自发自收) */
    transmitType?: number;
}

/** CANFD帧接口 */
export interface CanFDFrame {
    /** 帧ID */
    id: number;
    /** 数据长度 (0-64) */
    len: number;
    /** 数据内容 */
    data: number[];
    /** CANFD标志 (CANFD_BRS, CANFD_ESI) */
    flags?: number;
    /** 发送类型 */
    transmitType?: number;
}

/** 接收帧接口 */
export interface ReceivedFrame {
    /** 帧ID */
    id: number;
    /** 数据长度 */
    dlc: number;
    /** 数据内容 */
    data: number[];
    /** 时间戳 (微秒) */
    timestamp: number;
}

/** CANFD接收帧接口 */
export interface ReceivedFDFrame {
    /** 帧ID */
    id: number;
    /** 数据长度 */
    len: number;
    /** 数据内容 */
    data: number[];
    /** CANFD标志 */
    flags: number;
    /** 时间戳 (微秒) */
    timestamp: number;
}

/** CAN通道配置接口 */
export interface CanChannelConfig {
    /** CAN类型 (TYPE_CAN 或 TYPE_CANFD) */
    canType: CanTypeValue;
    /** 验收码 */
    accCode?: number;
    /** 验收屏蔽码 */
    accMask?: number;
    /** 保留 */
    reserved?: number;
    /** 滤波方式 */
    filter?: number;
    /** 波特率定时器0 (CAN模式) */
    timing0?: number;
    /** 波特率定时器1 (CAN模式) */
    timing1?: number;
    /** 工作模式 (0:正常, 1:只听) */
    mode?: number;
    /** 仲裁段波特率定时 (CANFD模式) */
    abitTiming?: number;
    /** 数据段波特率定时 (CANFD模式) */
    dbitTiming?: number;
    /** 波特率预分频 (CANFD模式) */
    brp?: number;
    /** 填充 */
    pad?: number;
}

/** 通道错误信息接口 */
export interface ChannelErrInfo {
    /** 错误码 */
    errorCode: number;
    /** 被动错误数据 */
    passiveErrData: number[];
    /** 仲裁丢失错误数据 */
    arLostErrData: number;
}

/** 通道状态接口 */
export interface ChannelStatus {
    /** 错误中断 */
    errInterrupt: number;
    /** 模式寄存器 */
    regMode: number;
    /** 状态寄存器 */
    regStatus: number;
    /** 仲裁丢失捕获 */
    regALCapture: number;
    /** 错误捕获 */
    regECCapture: number;
    /** 错误警告限制 */
    regEWLimit: number;
    /** 接收错误计数器 */
    regRECounter: number;
    /** 发送错误计数器 */
    regTECounter: number;
}

/** 版本信息接口 */
export interface VersionInfo {
    /** 主版本号 */
    major: number;
    /** 次版本号 */
    minor: number;
    /** 补丁版本号 */
    patch: number;
}

/** 设备信息接口 */
export interface DeviceInfo {
    /** 硬件版本 */
    hardwareVersion: number;
    /** 固件版本 */
    firmwareVersion: number;
    /** 驱动版本 */
    driverVersion: number;
    /** 库版本 */
    libraryVersion: number;
    /** IRQ号 */
    irqNumber: number;
    /** CAN通道数 */
    canNumber: number;
    /** 序列号 */
    serialNumber: string;
    /** 硬件类型 */
    hardwareType: string;
}

/** 扩展设备信息接口 */
export interface DeviceInfoEx {
    /** 硬件版本 */
    hardwareVersion: VersionInfo;
    /** 固件版本 */
    firmwareVersion: VersionInfo;
    /** 驱动版本 */
    driverVersion: VersionInfo;
    /** 库版本 */
    libraryVersion: VersionInfo;
    /** 设备名称 */
    deviceName: string;
    /** 硬件类型 */
    hardwareType: string;
    /** 序列号 */
    serialNumber: string;
    /** CAN通道数 */
    canChannelNumber: number;
    /** LIN通道数 */
    linChannelNumber: number;
}

/** CANFD数据对象接口 */
export interface CanFDDataObj {
    /** 时间戳 (微秒) */
    timestamp: number;
    /** 标志 */
    flag?: number;
    /** 帧ID */
    id: number;
    /** 数据长度 */
    len: number;
    /** CANFD标志 */
    flags?: number;
    /** 数据内容 */
    data: number[];
}

/** 错误数据接口 */
export interface ErrorData {
    /** 时间戳 (微秒) */
    timestamp: number;
    /** 错误类型 */
    errType: number;
    /** 错误子类型 */
    errSubType: number;
    /** 节点状态 */
    nodeState: number;
    /** 接收错误计数 */
    rxErrCount: number;
    /** 发送错误计数 */
    txErrCount: number;
    /** 错误数据 */
    errData: number;
}

/** 总线使用率数据接口 */
export interface BusUsageData {
    /** 开始时间戳 */
    timestampBegin: number;
    /** 结束时间戳 */
    timestampEnd: number;
    /** 通道 */
    chnl: number;
    /** 总线使用率 (0-10000, 即0%-100.00%) */
    busUsage: number;
    /** 帧计数 */
    frameCount: number;
}

/** 数据对象接口 */
export interface DataObj {
    /** 数据类型 */
    dataType: DataTypeValue;
    /** 通道 */
    chnl: number;
    /** CANFD数据 */
    canfdData?: CanFDDataObj;
    /** 错误数据 */
    errData?: ErrorData;
    /** 总线使用率数据 */
    busUsage?: BusUsageData;
}

/** 接收回调函数类型 */
export type ReceiveCallback = (frames: ReceivedFrame[]) => void;

/** CANFD接收回调函数类型 */
export type ReceiveFDCallback = (frames: ReceivedFDFrame[]) => void;

// ============== ZLG CAN设备封装类 ==============

/**
 * ZLG CAN设备封装类
 * 提供对ZLG CAN设备的完整操作接口
 */
export class ZlgCanDevice {
    private device: any;

    constructor() {
        this.device = new zlgcan.ZlgCanDevice();
    }

    // ==================== 设备操作 ====================

    /**
     * 打开设备
     * @param deviceType 设备类型 (参见DeviceType常量)
     * @param deviceIndex 设备索引 (从0开始)
     * @param reserved 保留参数 (默认为0)
     * @returns 成功返回true，失败返回false
     */
    openDevice(deviceType: DeviceTypeValue, deviceIndex: number, reserved: number = 0): boolean {
        return this.device.openDevice(deviceType, deviceIndex, reserved);
    }

    /**
     * 关闭设备
     * @returns 成功返回true，失败返回false
     */
    closeDevice(): boolean {
        return this.device.closeDevice();
    }

    /**
     * 获取设备信息
     * @returns 设备信息对象，失败返回null
     */
    getDeviceInfo(): DeviceInfo | null {
        return this.device.getDeviceInfo();
    }

    /**
     * 获取扩展设备信息
     * @returns 扩展设备信息对象，失败返回null
     */
    getDeviceInfoEx(): DeviceInfoEx | null {
        return this.device.getDeviceInfoEx();
    }

    /**
     * 检查设备是否在线
     * @returns 在线返回true，离线返回false
     */
    isDeviceOnLine(): boolean {
        return this.device.isDeviceOnLine();
    }

    // ==================== 属性操作 ====================

    /**
     * 设置设备属性值
     * @param path 属性路径
     * @param value 属性值
     * @returns 设置结果，1表示成功，0表示失败
     */
    setValue(path: string, value: string): number {
        return this.device.setValue(path, value);
    }

    /**
     * 获取设备属性值
     * @param path 属性路径
     * @returns 属性值字符串，失败返回null
     */
    getValue(path: string): string | null {
        return this.device.getValue(path);
    }

    // ==================== IProperty接口 ====================

    /**
     * 获取IProperty接口
     * @returns 是否成功获取
     */
    getIProperty(): boolean {
        return this.device.getIProperty();
    }

    /**
     * 通过IProperty设置属性值
     * @param path 属性路径
     * @param value 属性值
     * @returns 设置结果，1表示成功，0表示失败
     */
    setPropertyValue(path: string, value: string): number {
        return this.device.setPropertyValue(path, value);
    }

    /**
     * 通过IProperty获取属性值
     * @param path 属性路径
     * @returns 属性值字符串，失败返回null
     */
    getPropertyValue(path: string): string | null {
        return this.device.getPropertyValue(path);
    }

    /**
     * 释放IProperty接口
     * @returns 成功返回true，失败返回false
     */
    releaseIProperty(): boolean {
        return this.device.releaseIProperty();
    }

    // ==================== CAN通道操作 ====================

    /**
     * 初始化CAN通道
     * @param channelIndex 通道索引 (从0开始)
     * @param config 通道配置
     * @returns 通道句柄 (BigInt)，0n表示失败
     */
    initCanChannel(channelIndex: number, config: CanChannelConfig): ChannelHandle {
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
        const handle = this.device.initCanChannel(channelIndex, fullConfig);
        // C++层返回BigInt
        return typeof handle === 'bigint' ? handle : BigInt(handle);
    }

    /**
     * 启动CAN通道
     * @param channelHandle 通道句柄
     * @returns 成功返回true，失败返回false
     */
    startCanChannel(channelHandle: ChannelHandle): boolean {
        return this.device.startCanChannel(channelHandle);
    }

    /**
     * 复位CAN通道
     * @param channelHandle 通道句柄
     * @returns 成功返回true，失败返回false
     */
    resetCanChannel(channelHandle: ChannelHandle): boolean {
        return this.device.resetCanChannel(channelHandle);
    }

    /**
     * 清空CAN通道缓冲区
     * @param channelHandle 通道句柄
     * @returns 成功返回true，失败返回false
     */
    clearBuffer(channelHandle: ChannelHandle): boolean {
        return this.device.clearBuffer(channelHandle);
    }

    /**
     * 读取通道错误信息
     * @param channelHandle 通道句柄
     * @returns 错误信息对象，失败返回null
     */
    readChannelErrInfo(channelHandle: ChannelHandle): ChannelErrInfo | null {
        return this.device.readChannelErrInfo(channelHandle);
    }

    /**
     * 读取通道状态
     * @param channelHandle 通道句柄
     * @returns 通道状态对象，失败返回null
     */
    readChannelStatus(channelHandle: ChannelHandle): ChannelStatus | null {
        return this.device.readChannelStatus(channelHandle);
    }

    /**
     * 获取接收缓冲区帧数
     * @param channelHandle 通道句柄
     * @param type 帧类型 (TYPE_CAN, TYPE_CANFD, TYPE_ALL_DATA)
     * @returns 缓冲区中的帧数
     */
    getReceiveNum(channelHandle: ChannelHandle, type: CanTypeValue = CanType.TYPE_CAN): number {
        return this.device.getReceiveNum(channelHandle, type);
    }

    // ==================== 数据收发 ====================

    /**
     * 发送CAN帧
     * @param channelHandle 通道句柄
     * @param frames CAN帧或帧数组
     * @returns 成功发送的帧数
     */
    transmit(channelHandle: ChannelHandle, frames: CanFrame | CanFrame[]): number {
        const frameArray = Array.isArray(frames) ? frames : [frames];
        const fullFrames = frameArray.map(frame => ({
            id: frame.id,
            dlc: frame.dlc,
            data: frame.data,
            transmitType: frame.transmitType ?? 0,
        }));
        return this.device.transmit(channelHandle, fullFrames);
    }

    /**
     * 发送CANFD帧
     * @param channelHandle 通道句柄
     * @param frames CANFD帧或帧数组
     * @returns 成功发送的帧数
     */
    transmitFD(channelHandle: ChannelHandle, frames: CanFDFrame | CanFDFrame[]): number {
        const frameArray = Array.isArray(frames) ? frames : [frames];
        const fullFrames = frameArray.map(frame => ({
            id: frame.id,
            len: frame.len,
            data: frame.data,
            flags: frame.flags ?? 0,
            transmitType: frame.transmitType ?? 0,
        }));
        return this.device.transmitFD(channelHandle, fullFrames);
    }

    /**
     * 接收CAN帧
     * @param channelHandle 通道句柄
     * @param count 最大接收数量
     * @param waitTime 等待时间（毫秒），-1表示阻塞等待
     * @returns 接收到的帧数组
     */
    receive(channelHandle: ChannelHandle, count: number, waitTime: number = -1): ReceivedFrame[] {
        return this.device.receive(channelHandle, count, waitTime);
    }

    /**
     * 接收CANFD帧
     * @param channelHandle 通道句柄
     * @param count 最大接收数量
     * @param waitTime 等待时间（毫秒），-1表示阻塞等待
     * @returns 接收到的帧数组
     */
    receiveFD(channelHandle: ChannelHandle, count: number, waitTime: number = -1): ReceivedFDFrame[] {
        return this.device.receiveFD(channelHandle, count, waitTime);
    }

    /**
     * 发送合并数据对象
     * @param dataObjs 数据对象或数组
     * @returns 成功发送的数量
     */
    transmitData(dataObjs: DataObj | DataObj[]): number {
        return this.device.transmitData(dataObjs);
    }

    /**
     * 接收合并数据对象
     * @param count 最大接收数量
     * @param waitTime 等待时间（毫秒），-1表示阻塞等待
     * @returns 接收到的数据对象数组
     */
    receiveData(count: number, waitTime: number = -1): DataObj[] {
        return this.device.receiveData(count, waitTime);
    }

    /**
     * 设置接收回调
     * @param channelHandle 通道句柄
     * @param callback 回调函数
     * @returns 成功返回true，失败返回false
     */
    setReceiveCallback(channelHandle: ChannelHandle, callback: ReceiveCallback): boolean {
        return this.device.setReceiveCallback(channelHandle, callback);
    }

    /**
     * 清除接收回调
     * @param channelHandle 通道句柄
     * @returns 成功返回true，失败返回false
     */
    clearReceiveCallback(channelHandle: ChannelHandle): boolean {
        return this.device.clearReceiveCallback(channelHandle);
    }
}

// ============== 辅助函数 ==============

/**
 * 检查通道句柄是否有效
 * @param handle 通道句柄
 * @returns 有效返回true，无效返回false
 */
export function isValidChannelHandle(handle: ChannelHandle): boolean {
    return handle !== INVALID_CHANNEL_HANDLE;
}

/**
 * 获取设备类型名称
 * @param deviceType 设备类型值
 * @returns 设备类型名称
 */
export function getDeviceTypeName(deviceType: number): string {
    return DeviceTypeNames[deviceType] || `Unknown (${deviceType})`;
}

/**
 * 将波特率转换为timing0和timing1值
 * @param baudRate 波特率 (如 500000)
 * @returns timing参数对象，或null如果不支持该波特率
 */
export function baudRateToTiming(baudRate: number): { timing0: number; timing1: number } | null {
    const timingMap: Record<number, { timing0: number; timing1: number }> = {
        1000000: { timing0: 0x00, timing1: 0x14 },
        800000: { timing0: 0x00, timing1: 0x16 },
        500000: { timing0: 0x00, timing1: 0x1C },
        250000: { timing0: 0x01, timing1: 0x1C },
        125000: { timing0: 0x03, timing1: 0x1C },
        100000: { timing0: 0x04, timing1: 0x1C },
        50000: { timing0: 0x09, timing1: 0x1C },
        20000: { timing0: 0x18, timing1: 0x1C },
        10000: { timing0: 0x31, timing1: 0x1C },
        5000: { timing0: 0xBF, timing1: 0xFF },
    };
    return timingMap[baudRate] || null;
}

/**
 * 解析CAN帧ID中的标志位
 * @param canId CAN帧ID
 * @returns 解析结果对象
 */
export function parseCanId(canId: number): {
    id: number;
    isExtended: boolean;
    isRemote: boolean;
    isError: boolean;
} {
    return {
        id: canId & 0x1FFFFFFF,
        isExtended: (canId & CanFrameFlags.CAN_EFF_FLAG) !== 0,
        isRemote: (canId & CanFrameFlags.CAN_RTR_FLAG) !== 0,
        isError: (canId & CanFrameFlags.CAN_ERR_FLAG) !== 0,
    };
}

/**
 * 构建带标志位的CAN帧ID
 * @param id 帧ID
 * @param isExtended 是否为扩展帧
 * @param isRemote 是否为远程帧
 * @returns 带标志位的CAN帧ID
 */
export function buildCanId(id: number, isExtended: boolean = false, isRemote: boolean = false): number {
    let canId = id & 0x1FFFFFFF;
    if (isExtended) {
        canId |= CanFrameFlags.CAN_EFF_FLAG;
    }
    if (isRemote) {
        canId |= CanFrameFlags.CAN_RTR_FLAG;
    }
    return canId;
}

/**
 * 将数据数组转换为十六进制字符串
 * @param data 数据数组
 * @returns 十六进制字符串
 */
export function dataToHexString(data: number[]): string {
    return data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/**
 * 将十六进制字符串转换为数据数组
 * @param hexStr 十六进制字符串 (如 "01 02 03" 或 "010203")
 * @returns 数据数组
 */
export function hexStringToData(hexStr: string): number[] {
    const cleanStr = hexStr.replace(/\s+/g, '');
    const data: number[] = [];
    for (let i = 0; i < cleanStr.length; i += 2) {
        data.push(parseInt(cleanStr.substring(i, i + 2), 16));
    }
    return data;
}

// 导出默认的ZlgCanDevice类
export default ZlgCanDevice;
