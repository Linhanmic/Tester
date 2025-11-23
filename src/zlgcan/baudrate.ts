/**
 * CANFD 波特率配置模块
 * 提供常用波特率枚举、默认配置和简化的配置函数
 * 使用setValue方式配置，避免复杂的波特率计算
 *
 * 支持两种波特率单位:
 * - Hz (用于setValue API): 500000, 2000000 等
 * - kbps (用于tcaninit命令): 500, 2000 等
 */

import { ZlgCanDevice, CanType, CanChannelConfig } from './index';

/**
 * 仲裁域波特率枚举 (Arbitration Bit Rate)
 */
export const ArbitrationBaudRate = {
    /** 1Mbps 80% 采样点 */
    BAUD_1M: 1000000,
    /** 800kbps 80% 采样点 */
    BAUD_800K: 800000,
    /** 500kbps 80% 采样点 (推荐默认) */
    BAUD_500K: 500000,
    /** 250kbps 80% 采样点 */
    BAUD_250K: 250000,
    /** 125kbps 80% 采样点 */
    BAUD_125K: 125000,
    /** 100kbps 80% 采样点 */
    BAUD_100K: 100000,
    /** 50kbps 80% 采样点 */
    BAUD_50K: 50000,
    /** 自定义波特率 */
    CUSTOM: 0,
} as const;

/**
 * 数据域波特率枚举 (Data Bit Rate)
 */
export const DataBaudRate = {
    /** 5Mbps 75% 采样点 */
    BAUD_5M: 5000000,
    /** 4Mbps 80% 采样点 */
    BAUD_4M: 4000000,
    /** 2Mbps 80% 采样点 (推荐默认) */
    BAUD_2M: 2000000,
    /** 1Mbps 80% 采样点 */
    BAUD_1M: 1000000,
    /** 800kbps 80% 采样点 */
    BAUD_800K: 800000,
    /** 500kbps 80% 采样点 */
    BAUD_500K: 500000,
    /** 250kbps 80% 采样点 */
    BAUD_250K: 250000,
    /** 125kbps 80% 采样点 */
    BAUD_125K: 125000,
    /** 100kbps 80% 采样点 */
    BAUD_100K: 100000,
} as const;

/**
 * 协议类型
 */
export const Protocol = {
    /** 标准CAN */
    CAN: 0,
    /** CAN FD */
    CANFD: 1,
} as const;

/**
 * CANFD标准
 */
export const CanfdStandard = {
    /** CAN FD ISO标准 */
    ISO: 0,
    /** Non-ISO标准 */
    NON_ISO: 1,
} as const;

/**
 * CANFD加速模式
 */
export const CanfdAcceleration = {
    /** 禁用加速 */
    DISABLED: 0,
    /** 启用加速 */
    ENABLED: 1,
} as const;

/**
 * 工作模式
 */
export const WorkMode = {
    /** 正常模式 */
    NORMAL: 0,
    /** 只读模式 */
    READONLY: 1,
} as const;

/**
 * 终端电阻
 */
export const TerminalResistance = {
    /** 禁用 */
    DISABLED: 0,
    /** 使能 */
    ENABLED: 1,
} as const;

/**
 * 总线利用率上报
 */
export const BusUsageReport = {
    /** 禁用 */
    DISABLED: 0,
    /** 使能 */
    ENABLED: 1,
} as const;

/**
 * 发送重试策略
 */
export const TxRetryPolicy = {
    /** 单次发送 */
    ONCE: 1,
    /** 发送到总线关闭 */
    TILL_BUSOFF: 2,
} as const;

/**
 * 滤波模式
 */
export const FilterMode = {
    /** 标准帧滤波 */
    STANDARD: 0,
    /** 扩展帧滤波 */
    EXTENDED: 1,
    /** 禁用滤波 */
    DISABLED: 2,
} as const;

/**
 * 通道配置选项
 */
export interface ChannelConfigOptions {
    /** 协议类型 (默认: CANFD) */
    protocol?: number;
    /** CANFD标准 (默认: ISO) */
    canfdStandard?: number;
    /** CANFD加速 (默认: 启用) */
    canfdAcceleration?: number;
    /** 仲裁域波特率 (默认: 500kbps) */
    arbitrationBaudRate?: number;
    /** 数据域波特率 (默认: 2Mbps) */
    dataBaudRate?: number;
    /** 工作模式 (默认: 正常模式) */
    workMode?: number;
    /** 终端电阻 (默认: 使能) */
    terminalResistance?: number;
    /** 总线利用率上报 (默认: 禁用) */
    busUsageReport?: number;
    /** 总线利用率上报周期ms (默认: 1000) */
    busUsagePeriod?: number;
    /** 发送重试策略 (默认: 发送到总线关闭) */
    txRetryPolicy?: number;
    /** 滤波模式 (默认: 禁用) */
    filterMode?: number;
}

/**
 * 默认CANFD配置 (按图片所示)
 * - 协议: CAN FD
 * - CANFD标准: CAN FD ISO
 * - CANFD加速: 是
 * - 仲裁域波特率: 500kbps 80%
 * - 数据域波特率: 2Mbps 80%
 * - 工作模式: 正常模式
 * - 终端电阻: 使能
 * - 上报总线利用率: 禁能
 * - 发送重试: 发送到总线关闭
 * - 滤波: 禁用
 */
export const DEFAULT_CANFD_CONFIG: Required<ChannelConfigOptions> = {
    protocol: Protocol.CANFD,
    canfdStandard: CanfdStandard.ISO,
    canfdAcceleration: CanfdAcceleration.ENABLED,
    arbitrationBaudRate: ArbitrationBaudRate.BAUD_500K,
    dataBaudRate: DataBaudRate.BAUD_2M,
    workMode: WorkMode.NORMAL,
    terminalResistance: TerminalResistance.ENABLED,
    busUsageReport: BusUsageReport.DISABLED,
    busUsagePeriod: 1000,
    txRetryPolicy: TxRetryPolicy.TILL_BUSOFF,
    filterMode: FilterMode.DISABLED,
};

/**
 * 默认CAN配置
 */
export const DEFAULT_CAN_CONFIG: Required<ChannelConfigOptions> = {
    protocol: Protocol.CAN,
    canfdStandard: CanfdStandard.ISO,
    canfdAcceleration: CanfdAcceleration.DISABLED,
    arbitrationBaudRate: ArbitrationBaudRate.BAUD_500K,
    dataBaudRate: DataBaudRate.BAUD_500K,
    workMode: WorkMode.NORMAL,
    terminalResistance: TerminalResistance.ENABLED,
    busUsageReport: BusUsageReport.DISABLED,
    busUsagePeriod: 1000,
    txRetryPolicy: TxRetryPolicy.TILL_BUSOFF,
    filterMode: FilterMode.DISABLED,
};

/**
 * 常用配置预设
 */
export const ConfigPresets = {
    /** 默认CANFD配置: 500kbps/2Mbps */
    CANFD_500K_2M: {
        ...DEFAULT_CANFD_CONFIG,
    },
    /** 高速CANFD配置: 1Mbps/5Mbps */
    CANFD_1M_5M: {
        ...DEFAULT_CANFD_CONFIG,
        arbitrationBaudRate: ArbitrationBaudRate.BAUD_1M,
        dataBaudRate: DataBaudRate.BAUD_5M,
    },
    /** 高速CANFD配置: 1Mbps/4Mbps */
    CANFD_1M_4M: {
        ...DEFAULT_CANFD_CONFIG,
        arbitrationBaudRate: ArbitrationBaudRate.BAUD_1M,
        dataBaudRate: DataBaudRate.BAUD_4M,
    },
    /** 中速CANFD配置: 500kbps/4Mbps */
    CANFD_500K_4M: {
        ...DEFAULT_CANFD_CONFIG,
        dataBaudRate: DataBaudRate.BAUD_4M,
    },
    /** 低速CANFD配置: 250kbps/1Mbps */
    CANFD_250K_1M: {
        ...DEFAULT_CANFD_CONFIG,
        arbitrationBaudRate: ArbitrationBaudRate.BAUD_250K,
        dataBaudRate: DataBaudRate.BAUD_1M,
    },
    /** 标准CAN配置: 500kbps */
    CAN_500K: {
        ...DEFAULT_CAN_CONFIG,
    },
    /** 高速CAN配置: 1Mbps */
    CAN_1M: {
        ...DEFAULT_CAN_CONFIG,
        arbitrationBaudRate: ArbitrationBaudRate.BAUD_1M,
    },
    /** 低速CAN配置: 125kbps */
    CAN_125K: {
        ...DEFAULT_CAN_CONFIG,
        arbitrationBaudRate: ArbitrationBaudRate.BAUD_125K,
    },
} as const;

/**
 * 配置结果
 */
export interface ConfigureResult {
    success: boolean;
    channel: number;
    errors: string[];
}

/**
 * 使用setValue配置通道（必须在initCanChannel之前调用）
 * @param device ZlgCanDevice实例
 * @param channelIndex 通道索引
 * @param options 配置选项（可选，使用默认CANFD配置）
 * @returns 配置结果
 */
export function configureChannelWithSetValue(
    device: ZlgCanDevice,
    channelIndex: number,
    options: ChannelConfigOptions = {}
): ConfigureResult {
    const config = { ...DEFAULT_CANFD_CONFIG, ...options };
    const ch = channelIndex.toString();
    const errors: string[] = [];

    // 设置仲裁域波特率
    const abitResult = device.setValue(`${ch}/canfd_abit_baud_rate`, config.arbitrationBaudRate.toString());
    if (abitResult === 0) {
        errors.push(`通道${ch} 设置仲裁段波特率失败`);
    }

    // 如果是CANFD协议，设置数据域波特率
    if (config.protocol === Protocol.CANFD && config.canfdAcceleration === CanfdAcceleration.ENABLED) {
        const dbitResult = device.setValue(`${ch}/canfd_dbit_baud_rate`, config.dataBaudRate.toString());
        if (dbitResult === 0) {
            errors.push(`通道${ch} 设置数据段波特率失败`);
        }
    }

    // 设置终端电阻
    const resistResult = device.setValue(`${ch}/initenal_resistance`, config.terminalResistance.toString());
    if (resistResult === 0) {
        errors.push(`通道${ch} 设置终端电阻失败`);
    }

    // 设置总线利用率上报
    const busUsageResult = device.setValue(`${ch}/set_bus_usage_enable`, config.busUsageReport.toString());
    if (busUsageResult === 0) {
        errors.push(`通道${ch} 设置总线利用率上报失败`);
    }

    // 如果启用了总线利用率上报，设置周期
    if (config.busUsageReport === BusUsageReport.ENABLED) {
        const periodResult = device.setValue(`${ch}/set_bus_usage_period`, config.busUsagePeriod.toString());
        if (periodResult === 0) {
            errors.push(`通道${ch} 设置总线利用率周期失败`);
        }
    }

    // 设置发送重试策略
    const retryResult = device.setValue(`${ch}/set_tx_retry_policy`, config.txRetryPolicy.toString());
    if (retryResult === 0) {
        errors.push(`通道${ch} 设置发送重试策略失败`);
    }

    return {
        success: errors.length === 0,
        channel: channelIndex,
        errors,
    };
}

/**
 * 获取initCanChannel所需的配置对象
 * @param options 配置选项
 * @returns CanChannelConfig对象
 */
export function getChannelConfig(options: ChannelConfigOptions = {}): CanChannelConfig {
    const config = { ...DEFAULT_CANFD_CONFIG, ...options };

    return {
        canType: config.protocol === Protocol.CANFD ? CanType.TYPE_CANFD : CanType.TYPE_CAN,
        accCode: 0,
        accMask: 0xFFFFFFFF,
        abitTiming: 0x00016D01,
        dbitTiming: 0x00016D01,
        brp: 0,
        filter: 0,
        mode: config.workMode,
        pad: 0,
        reserved: 0,
    };
}

/**
 * 快速配置并初始化通道
 * @param device ZlgCanDevice实例
 * @param channelIndex 通道索引
 * @param options 配置选项
 * @returns 通道句柄（0表示失败）
 */
export function quickInitChannel(
    device: ZlgCanDevice,
    channelIndex: number,
    options: ChannelConfigOptions = {}
): number {
    // 先使用setValue配置波特率等参数
    const configResult = configureChannelWithSetValue(device, channelIndex, options);
    if (!configResult.success) {
        console.error(`通道${channelIndex}配置失败:`, configResult.errors);
        return 0;
    }

    // 获取initCanChannel所需的配置
    const channelConfig = getChannelConfig(options);

    // 初始化通道
    return device.initCanChannel(channelIndex, channelConfig);
}

/**
 * 格式化波特率显示
 * @param baudRate 波特率值
 * @returns 格式化的字符串
 */
export function formatBaudRate(baudRate: number): string {
    if (baudRate >= 1000000) {
        return `${baudRate / 1000000}Mbps`;
    } else if (baudRate >= 1000) {
        return `${baudRate / 1000}kbps`;
    }
    return `${baudRate}bps`;
}

/**
 * 获取配置摘要
 * @param options 配置选项
 * @returns 配置摘要字符串
 */
export function getConfigSummary(options: ChannelConfigOptions = {}): string {
    const config = { ...DEFAULT_CANFD_CONFIG, ...options };
    const lines: string[] = [];

    lines.push(`协议: ${config.protocol === Protocol.CANFD ? 'CAN FD' : 'CAN'}`);
    if (config.protocol === Protocol.CANFD) {
        lines.push(`CANFD标准: ${config.canfdStandard === CanfdStandard.ISO ? 'CAN FD ISO' : 'Non-ISO'}`);
        lines.push(`CANFD加速: ${config.canfdAcceleration === CanfdAcceleration.ENABLED ? '是' : '否'}`);
    }
    lines.push(`仲裁域波特率: ${formatBaudRate(config.arbitrationBaudRate)}`);
    if (config.protocol === Protocol.CANFD && config.canfdAcceleration === CanfdAcceleration.ENABLED) {
        lines.push(`数据域波特率: ${formatBaudRate(config.dataBaudRate)}`);
    }
    lines.push(`工作模式: ${config.workMode === WorkMode.NORMAL ? '正常模式' : '只读模式'}`);
    lines.push(`终端电阻: ${config.terminalResistance === TerminalResistance.ENABLED ? '使能' : '禁能'}`);
    lines.push(`总线利用率上报: ${config.busUsageReport === BusUsageReport.ENABLED ? '使能' : '禁能'}`);
    lines.push(`发送重试: ${config.txRetryPolicy === TxRetryPolicy.TILL_BUSOFF ? '发送到总线关闭' : '单次发送'}`);

    return lines.join('\n');
}

// ============================================================================
// tcaninit 命令支持 (kbps单位)
// ============================================================================

/**
 * 仲裁域波特率 (kbps单位，用于tcaninit命令)
 */
export const ArbitrationBaudRateKbps = {
    /** 1Mbps */
    BAUD_1M: 1000,
    /** 800kbps */
    BAUD_800K: 800,
    /** 500kbps (默认) */
    BAUD_500K: 500,
    /** 250kbps */
    BAUD_250K: 250,
    /** 125kbps */
    BAUD_125K: 125,
    /** 100kbps */
    BAUD_100K: 100,
    /** 50kbps */
    BAUD_50K: 50,
} as const;

/**
 * 数据域波特率 (kbps单位，用于tcaninit命令)
 */
export const DataBaudRateKbps = {
    /** 5Mbps */
    BAUD_5M: 5000,
    /** 4Mbps */
    BAUD_4M: 4000,
    /** 2Mbps (默认) */
    BAUD_2M: 2000,
    /** 1Mbps */
    BAUD_1M: 1000,
    /** 800kbps */
    BAUD_800K: 800,
    /** 500kbps */
    BAUD_500K: 500,
    /** 250kbps */
    BAUD_250K: 250,
    /** 125kbps */
    BAUD_125K: 125,
    /** 100kbps */
    BAUD_100K: 100,
} as const;

/**
 * tcaninit命令解析结果
 */
export interface TcanInitParams {
    /** 设备ID */
    deviceId: number;
    /** 设备索引 */
    deviceIndex: number;
    /** 通道索引 */
    channelIndex: number;
    /** 仲裁域波特率 (kbps) */
    arbitrationBaudRateKbps: number;
    /** 数据域波特率 (kbps), 可选 */
    dataBaudRateKbps?: number;
    /** 是否为CANFD模式 */
    isCanFd: boolean;
}

/**
 * 解析tcaninit命令
 * @param command tcaninit命令字符串，如 "tcaninit 1,0,0,500" 或 "tcaninit 1,0,1,500,2000"
 * @returns 解析结果，失败返回null
 */
export function parseTcanInitCommand(command: string): TcanInitParams | null {
    // 移除开头的tcaninit和空格
    const trimmed = command.trim();
    const match = trimmed.match(/^tcaninit\s+(.+)$/i);
    if (!match) {
        return null;
    }

    const params = match[1].split(',').map(p => p.trim());
    if (params.length < 4 || params.length > 5) {
        return null;
    }

    const deviceId = parseInt(params[0], 10);
    const deviceIndex = parseInt(params[1], 10);
    const channelIndex = parseInt(params[2], 10);
    const arbitrationBaudRateKbps = parseInt(params[3], 10);

    if (isNaN(deviceId) || isNaN(deviceIndex) || isNaN(channelIndex) || isNaN(arbitrationBaudRateKbps)) {
        return null;
    }

    let dataBaudRateKbps: number | undefined;
    if (params.length === 5) {
        dataBaudRateKbps = parseInt(params[4], 10);
        if (isNaN(dataBaudRateKbps)) {
            return null;
        }
    }

    return {
        deviceId,
        deviceIndex,
        channelIndex,
        arbitrationBaudRateKbps,
        dataBaudRateKbps,
        isCanFd: dataBaudRateKbps !== undefined,
    };
}

/**
 * 将kbps转换为Hz
 * @param kbps 波特率(kbps)
 * @returns 波特率(Hz)
 */
export function kbpsToHz(kbps: number): number {
    return kbps * 1000;
}

/**
 * 将Hz转换为kbps
 * @param hz 波特率(Hz)
 * @returns 波特率(kbps)
 */
export function hzToKbps(hz: number): number {
    return hz / 1000;
}

/**
 * 根据tcaninit参数创建配置选项
 * @param params tcaninit参数
 * @returns 配置选项
 */
export function createConfigFromTcanInit(params: TcanInitParams): ChannelConfigOptions {
    const config: ChannelConfigOptions = {
        ...DEFAULT_CANFD_CONFIG,
        arbitrationBaudRate: kbpsToHz(params.arbitrationBaudRateKbps),
    };

    if (params.isCanFd && params.dataBaudRateKbps) {
        config.protocol = Protocol.CANFD;
        config.canfdAcceleration = CanfdAcceleration.ENABLED;
        config.dataBaudRate = kbpsToHz(params.dataBaudRateKbps);
    } else {
        config.protocol = Protocol.CAN;
        config.canfdAcceleration = CanfdAcceleration.DISABLED;
    }

    return config;
}

/**
 * 使用tcaninit参数配置并初始化通道
 * @param device ZlgCanDevice实例
 * @param params tcaninit参数
 * @returns 通道句柄（0表示失败）
 */
export function initChannelWithTcanInit(
    device: ZlgCanDevice,
    params: TcanInitParams
): number {
    const config = createConfigFromTcanInit(params);
    return quickInitChannel(device, params.channelIndex, config);
}

/**
 * 验证波特率是否有效
 * @param arbitrationKbps 仲裁域波特率(kbps)
 * @param dataKbps 数据域波特率(kbps)，可选
 * @returns 是否有效
 */
export function isValidBaudRate(arbitrationKbps: number, dataKbps?: number): boolean {
    const validArbitration = [50, 100, 125, 250, 500, 800, 1000];
    const validData = [100, 125, 250, 500, 800, 1000, 2000, 4000, 5000];

    if (!validArbitration.includes(arbitrationKbps)) {
        return false;
    }

    if (dataKbps !== undefined && !validData.includes(dataKbps)) {
        return false;
    }

    return true;
}

/**
 * 获取tcaninit命令示例
 * @returns 命令示例数组
 */
export function getTcanInitExamples(): string[] {
    return [
        'tcaninit 1,0,0,500        // CAN: 设备1, 索引0, 通道0, 500kbps',
        'tcaninit 1,0,1,500,2000   // CANFD: 设备1, 索引0, 通道1, 500kbps/2Mbps',
        'tcaninit 1,0,0,1000,5000  // CANFD高速: 1Mbps/5Mbps',
        'tcaninit 2,0,0,250,1000   // CANFD低速: 250kbps/1Mbps',
    ];
}
