import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
  private static readonly CONFIG_DIR = '.tester';
  private static readonly CONFIG_FILE = 'devices.json';
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * 获取配置文件路径
   */
  private getConfigFilePath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }
    const configDir = path.join(workspaceFolder.uri.fsPath, DeviceConfigManager.CONFIG_DIR);
    return path.join(configDir, DeviceConfigManager.CONFIG_FILE);
  }

  /**
   * 确保配置目录存在
   */
  private ensureConfigDir(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }
    const configDir = path.join(workspaceFolder.uri.fsPath, DeviceConfigManager.CONFIG_DIR);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    return configDir;
  }

  /**
   * 从文件读取配置
   */
  private readConfigFile(): SavedDeviceConfig[] {
    const configPath = this.getConfigFilePath();
    if (!configPath || !fs.existsSync(configPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read device config file:', error);
      return [];
    }
  }

  /**
   * 写入配置到文件
   */
  private writeConfigFile(configs: SavedDeviceConfig[]): boolean {
    this.ensureConfigDir();
    const configPath = this.getConfigFilePath();
    if (!configPath) {
      return false;
    }

    try {
      fs.writeFileSync(configPath, JSON.stringify(configs, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Failed to write device config file:', error);
      return false;
    }
  }

  /**
   * 获取所有设备配置
   */
  public getAll(): SavedDeviceConfig[] {
    // 优先从文件读取，如果文件不存在或为空，则从GlobalState读取（用于迁移）
    const fileConfigs = this.readConfigFile();
    if (fileConfigs.length > 0) {
      return fileConfigs;
    }

    // 从旧的GlobalState读取（用于向后兼容）
    const globalConfigs = this.context.globalState.get<SavedDeviceConfig[]>(DeviceConfigManager.STORAGE_KEY, []);
    if (globalConfigs.length > 0) {
      // 自动迁移到文件存储
      this.writeConfigFile(globalConfigs);
      return globalConfigs;
    }

    return [];
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

    // 保存到文件
    const success = this.writeConfigFile(configs);
    if (!success) {
      // 如果文件保存失败，回退到GlobalState
      await this.context.globalState.update(DeviceConfigManager.STORAGE_KEY, configs);
    }
  }

  /**
   * 删除设备配置
   */
  public async delete(id: string): Promise<void> {
    const configs = this.getAll();
    const filtered = configs.filter(c => c.id !== id);

    // 保存到文件
    const success = this.writeConfigFile(filtered);
    if (!success) {
      // 如果文件保存失败，回退到GlobalState
      await this.context.globalState.update(DeviceConfigManager.STORAGE_KEY, filtered);
    }
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
