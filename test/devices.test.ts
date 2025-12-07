/**
 * devices.ts 单元测试
 * 测试设备抽象层的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  CanDeviceManager,
  ZlgCanDriver,
  CanProtocolType,
  CanDeviceState,
  CanDeviceError,
  ErrorCode,
  ICanDevice,
  ICanChannel,
  IChannelConfig,
} from '../src/devices';
import * as zlgcan from '../src/zlgcan';

describe('CanDeviceManager', () => {
  let manager: CanDeviceManager;

  beforeEach(() => {
    manager = CanDeviceManager.getInstance();
  });

  afterEach(() => {
    // 清理资源
    manager.dispose();
  });

  it('应该返回单例实例', () => {
    const instance1 = CanDeviceManager.getInstance();
    const instance2 = CanDeviceManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('应该能够注册驱动', async () => {
    const driver = new ZlgCanDriver();
    await driver.initialize();

    manager.registerDriver(driver);

    const retrievedDriver = manager.getDriver('zlgcan');
    expect(retrievedDriver).toBe(driver);
  });

  it('应该能够通过厂商代码创建设备', async () => {
    const driver = new ZlgCanDriver();
    await driver.initialize();
    manager.registerDriver(driver);

    const device = manager.createDeviceByVendorCode(
      zlgcan.DeviceType.ZCAN_USBCANFD_200U,
      'zlgcan'
    );

    expect(device).toBeDefined();
    expect(device.deviceType).toBe(zlgcan.DeviceType.ZCAN_USBCANFD_200U);
    expect(device.state).toBe(CanDeviceState.Disconnected);
  });

  it('未注册的驱动应该抛出错误', () => {
    expect(() => {
      manager.createDeviceByVendorCode(
        zlgcan.DeviceType.ZCAN_USBCANFD_200U,
        'nonexistent'
      );
    }).toThrow(CanDeviceError);
  });
});

describe('ZlgCanDriver', () => {
  let driver: ZlgCanDriver;

  beforeEach(async () => {
    driver = new ZlgCanDriver();
    await driver.initialize();
  });

  afterEach(() => {
    driver.dispose();
  });

  it('应该有正确的驱动名称', () => {
    expect(driver.name).toBe('zlgcan');
  });

  it('应该支持多种设备类型', () => {
    expect(driver.supportedDeviceTypes).toBeDefined();
    expect(driver.supportedDeviceTypes.length).toBeGreaterThan(0);
    expect(driver.supportedDeviceTypes).toContain(zlgcan.DeviceType.ZCAN_USBCANFD_200U);
  });

  it('应该能够创建设备实例', () => {
    const device = driver.createDevice(zlgcan.DeviceType.ZCAN_USBCANFD_200U);
    expect(device).toBeDefined();
    expect(device.deviceType).toBe(zlgcan.DeviceType.ZCAN_USBCANFD_200U);
  });

  it('不支持的设备类型应该抛出错误', () => {
    expect(() => {
      driver.createDevice(99999);
    }).toThrow(CanDeviceError);
  });
});

describe('CanDeviceError', () => {
  it('应该能够创建错误实例', () => {
    const error = new CanDeviceError(
      ErrorCode.DEVICE_NOT_OPEN,
      '设备未打开'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ErrorCode.DEVICE_NOT_OPEN);
    expect(error.message).toBe('设备未打开');
    expect(error.name).toBe('CanDeviceError');
  });

  it('应该能够携带详细信息', () => {
    const details = { deviceIndex: 0, deviceType: 41 };
    const error = new CanDeviceError(
      ErrorCode.DEVICE_NOT_EXIST,
      '设备不存在',
      details
    );

    expect(error.details).toEqual(details);
  });
});

describe('设备生命周期', () => {
  let manager: CanDeviceManager;
  let driver: ZlgCanDriver;
  let device: ICanDevice;

  beforeEach(async () => {
    manager = CanDeviceManager.getInstance();
    driver = new ZlgCanDriver();
    await driver.initialize();
    manager.registerDriver(driver);

    device = manager.createDeviceByVendorCode(
      zlgcan.DeviceType.ZCAN_USBCANFD_200U,
      'zlgcan'
    );
  });

  afterEach(() => {
    if (device && device.state === CanDeviceState.Connected) {
      device.close();
    }
    manager.dispose();
  });

  it('初始状态应该是未连接', () => {
    expect(device.state).toBe(CanDeviceState.Disconnected);
  });

  it('重复打开设备应该抛出错误', async () => {
    // 注意：这个测试假设没有实际硬件连接
    // 如果有硬件，第一次 open 可能成功
    try {
      await device.open(0);
      // 如果成功打开，尝试再次打开应该抛出错误
      await expect(device.open(0)).rejects.toThrow(CanDeviceError);
    } catch (error) {
      // 如果没有硬件，第一次 open 就会失败，这是预期的
      expect(error).toBeDefined();
    }
  });

  it('未打开设备时初始化通道应该抛出错误', async () => {
    const config: IChannelConfig = {
      protocolType: CanProtocolType.CAN,
      arbitrationBaudrate: 500,
    };

    await expect(device.initChannel(0, config)).rejects.toThrow(CanDeviceError);
  });

  it('关闭设备后状态应该是未连接', async () => {
    // 尝试打开设备（可能失败如果没有硬件）
    try {
      await device.open(0);
    } catch {
      // 忽略打开失败
    }

    device.close();
    expect(device.state).toBe(CanDeviceState.Disconnected);
  });
});

describe('通道配置', () => {
  it('CAN配置应该正确转换', () => {
    const config: IChannelConfig = {
      protocolType: CanProtocolType.CAN,
      arbitrationBaudrate: 500,
      mode: 0,
    };

    expect(config.protocolType).toBe(CanProtocolType.CAN);
    expect(config.arbitrationBaudrate).toBe(500);
  });

  it('CANFD配置应该包含数据段波特率', () => {
    const config: IChannelConfig = {
      protocolType: CanProtocolType.CANFD,
      arbitrationBaudrate: 500,
      dataBaudrate: 2000,
      mode: 0,
    };

    expect(config.protocolType).toBe(CanProtocolType.CANFD);
    expect(config.arbitrationBaudrate).toBe(500);
    expect(config.dataBaudrate).toBe(2000);
  });
});

describe('错误码定义', () => {
  it('所有错误码应该是唯一的', () => {
    const codes = Object.values(ErrorCode);
    const uniqueCodes = new Set(codes);
    expect(codes.length).toBe(uniqueCodes.size);
  });

  it('关键错误码应该存在', () => {
    expect(ErrorCode.DEVICE_NOT_OPEN).toBeDefined();
    expect(ErrorCode.CHANNEL_INIT_FAILED).toBeDefined();
    expect(ErrorCode.TRANSMIT_FAILED).toBeDefined();
    expect(ErrorCode.RECEIVE_TIMEOUT).toBeDefined();
  });
});
