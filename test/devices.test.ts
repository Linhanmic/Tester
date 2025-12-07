/**
 * devices.ts 单元测试
 * 测试设备抽象层的核心功能
 */

/// <reference types="node" />

import {
  CanDeviceManager,
  ZlgCanDriver,
  CanProtocolType,
  CanDeviceState,
  CanDeviceError,
  ErrorCode,
  ICanDevice,
  IChannelConfig,
} from '../src/devices';
import * as zlgcan from '../src/zlgcan';

console.log('========================================');
console.log('设备抽象层单元测试');
console.log('========================================\n');

async function runTests() {
  let passedTests = 0;
  let failedTests = 0;
  const totalTests = 14;

  // ========== CanDeviceManager 测试 ==========

  console.log('【CanDeviceManager 测试】\n');

  // 测试1: 单例实例
  console.log('[测试1/14] 应该返回单例实例');
  try {
    const instance1 = CanDeviceManager.getInstance();
    const instance2 = CanDeviceManager.getInstance();

    if (instance1 === instance2) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('单例实例不一致');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试2: 注册驱动
  console.log('[测试2/14] 应该能够注册驱动');
  const manager = CanDeviceManager.getInstance();
  let driver: ZlgCanDriver;
  try {
    driver = new ZlgCanDriver();
    await driver.initialize();
    manager.registerDriver(driver);

    const retrievedDriver = manager.getDriver('zlgcan');
    if (retrievedDriver === driver) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('注册的驱动不匹配');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
    return;
  }

  // 测试3: 通过厂商代码创建设备
  console.log('[测试3/14] 应该能够通过厂商代码创建设备');
  try {
    const device = manager.createDeviceByVendorCode(
      zlgcan.DeviceType.ZCAN_USBCANFD_200U,
      'zlgcan'
    );

    if (device &&
        device.deviceType === zlgcan.DeviceType.ZCAN_USBCANFD_200U &&
        device.state === CanDeviceState.Disconnected) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('设备创建失败或属性不正确');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试4: 未注册的驱动应抛出错误
  console.log('[测试4/14] 未注册的驱动应该抛出错误');
  try {
    let errorThrown = false;
    try {
      manager.createDeviceByVendorCode(
        zlgcan.DeviceType.ZCAN_USBCANFD_200U,
        'nonexistent'
      );
    } catch (error) {
      if (error instanceof CanDeviceError) {
        errorThrown = true;
      }
    }

    if (errorThrown) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('未抛出预期的 CanDeviceError');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // ========== ZlgCanDriver 测试 ==========

  console.log('【ZlgCanDriver 测试】\n');

  // 测试5: 驱动名称
  console.log('[测试5/14] 应该有正确的驱动名称');
  try {
    if (driver.name === 'zlgcan') {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error(`驱动名称错误: ${driver.name}`);
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试6: 支持的设备类型
  console.log('[测试6/14] 应该支持多种设备类型');
  try {
    if (driver.supportedDeviceTypes &&
        driver.supportedDeviceTypes.length > 0 &&
        driver.supportedDeviceTypes.includes(zlgcan.DeviceType.ZCAN_USBCANFD_200U)) {
      console.log(`  支持 ${driver.supportedDeviceTypes.length} 种设备类型`);
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('支持的设备类型不正确');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试7: 创建设备实例
  console.log('[测试7/14] 应该能够创建设备实例');
  try {
    const device = driver.createDevice(zlgcan.DeviceType.ZCAN_USBCANFD_200U);
    if (device && device.deviceType === zlgcan.DeviceType.ZCAN_USBCANFD_200U) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('设备实例创建失败');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试8: 不支持的设备类型
  console.log('[测试8/14] 不支持的设备类型应该抛出错误');
  try {
    let errorThrown = false;
    try {
      driver.createDevice(99999);
    } catch (error) {
      if (error instanceof CanDeviceError) {
        errorThrown = true;
      }
    }

    if (errorThrown) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('未抛出预期的 CanDeviceError');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // ========== CanDeviceError 测试 ==========

  console.log('【CanDeviceError 测试】\n');

  // 测试9: 错误实例
  console.log('[测试9/14] 应该能够创建错误实例');
  try {
    const error = new CanDeviceError(
      ErrorCode.DEVICE_NOT_OPEN,
      '设备未打开'
    );

    if (error instanceof Error &&
        error.code === ErrorCode.DEVICE_NOT_OPEN &&
        error.message === '设备未打开' &&
        error.name === 'CanDeviceError') {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('错误实例属性不正确');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试10: 错误详细信息
  console.log('[测试10/14] 应该能够携带详细信息');
  try {
    const details = { deviceIndex: 0, deviceType: 41 };
    const error = new CanDeviceError(
      ErrorCode.DEVICE_NOT_EXIST,
      '设备不存在',
      details
    );

    if (JSON.stringify(error.details) === JSON.stringify(details)) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('错误详细信息不匹配');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // ========== 设备生命周期测试 ==========

  console.log('【设备生命周期测试】\n');

  const device = manager.createDeviceByVendorCode(
    zlgcan.DeviceType.ZCAN_USBCANFD_200U,
    'zlgcan'
  );

  // 测试11: 初始状态
  console.log('[测试11/14] 初始状态应该是未连接');
  try {
    if (device.state === CanDeviceState.Disconnected) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error(`初始状态错误: ${device.state}`);
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试12: 未打开设备时初始化通道应抛出错误
  console.log('[测试12/14] 未打开设备时初始化通道应该抛出错误');
  try {
    const config: IChannelConfig = {
      protocolType: CanProtocolType.CAN,
      arbitrationBaudrate: 500,
    };

    let errorThrown = false;
    try {
      await device.initChannel(0, config);
    } catch (error) {
      if (error instanceof CanDeviceError) {
        errorThrown = true;
      }
    }

    if (errorThrown) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('未抛出预期的 CanDeviceError');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // ========== 通道配置测试 ==========

  console.log('【通道配置测试】\n');

  // 测试13: CAN配置
  console.log('[测试13/14] CAN配置应该正确');
  try {
    const config: IChannelConfig = {
      protocolType: CanProtocolType.CAN,
      arbitrationBaudrate: 500,
      mode: 0,
    };

    if (config.protocolType === CanProtocolType.CAN &&
        config.arbitrationBaudrate === 500) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('CAN配置不正确');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试14: CANFD配置
  console.log('[测试14/14] CANFD配置应该包含数据段波特率');
  try {
    const config: IChannelConfig = {
      protocolType: CanProtocolType.CANFD,
      arbitrationBaudrate: 500,
      dataBaudrate: 2000,
      mode: 0,
    };

    if (config.protocolType === CanProtocolType.CANFD &&
        config.arbitrationBaudrate === 500 &&
        config.dataBaudrate === 2000) {
      console.log('✓ 通过\n');
      passedTests++;
    } else {
      throw new Error('CANFD配置不正确');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 清理资源
  device.close();
  manager.dispose();

  // 输出结果
  console.log('========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  console.log(`通过: ${passedTests}/${totalTests}`);
  console.log(`失败: ${failedTests}/${totalTests}`);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log('\n✓ 所有测试通过！\n');
    process.exit(0);
  } else {
    console.log(`\n✗ ${failedTests} 个测试失败\n`);
    process.exit(1);
  }
}

// 运行测试
runTests().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
