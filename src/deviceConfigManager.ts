import * as vscode from 'vscode';

/** 设备通道配置 */
export interface DeviceChannelConfig {
  channelIndex: number;
  projectChannelIndex: number;
  arbitrationBaudrate: number;
  dataBaudrate?: number;
}

/** 设备配置 */
export interface SavedDeviceConfig {
  id: string;
  name: string;
  deviceType: number;
  deviceIndex: number;
  channels: DeviceChannelConfig[];
  description?: string;
  createdAt: number;
  lastUsed?: number;
}

/**
 * 设备配置管理器
 * 负责存储和管理设备配置列表
 */
export class DeviceConfigManager {
  private static readonly STORAGE_KEY = 'tester.deviceConfigs';
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * 获取所有设备配置
   */
  public getAll(): SavedDeviceConfig[] {
    return this.context.globalState.get<SavedDeviceConfig[]>(DeviceConfigManager.STORAGE_KEY, []);
  }

  /**
   * 获取指定设备配置
   */
  public get(id: string): SavedDeviceConfig | undefined {
    const configs = this.getAll();
    return configs.find(c => c.id === id);
  }

  /**
   * 保存设备配置
   */
  public async save(config: SavedDeviceConfig): Promise<void> {
    const configs = this.getAll();
    const index = configs.findIndex(c => c.id === config.id);

    if (index >= 0) {
      configs[index] = config;
    } else {
      configs.push(config);
    }

    await this.context.globalState.update(DeviceConfigManager.STORAGE_KEY, configs);
  }

  /**
   * 删除设备配置
   */
  public async delete(id: string): Promise<void> {
    const configs = this.getAll();
    const filtered = configs.filter(c => c.id !== id);
    await this.context.globalState.update(DeviceConfigManager.STORAGE_KEY, filtered);
  }

  /**
   * 更新最后使用时间
   */
  public async updateLastUsed(id: string): Promise<void> {
    const config = this.get(id);
    if (config) {
      config.lastUsed = Date.now();
      await this.save(config);
    }
  }

  /**
   * 创建新的设备配置ID
   */
  public generateId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
