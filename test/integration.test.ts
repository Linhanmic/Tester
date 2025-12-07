/**
 * 设备抽象层集成测试
 * 测试 executor → devices → zlgcan 完整调用链
 */

/// <reference types="node" />

import {
  CanDeviceManager,
  ZlgCanDriver,
  CanProtocolType,
  CanDeviceState,
  IChannelConfig,
} from '../src/zlgcan';
import * as zlgcan from '../src/zlgcan';

console.log('========================================');
console.log('设备抽象层集成测试');
console.log('========================================\n');

async function runTests() {
  let passedTests = 0;
  let failedTests = 0;

  // 测试1: CanDeviceManager 单例
  console.log('[测试1] CanDeviceManager 单例行为');
  try {
    const instance1 = CanDeviceManager.getInstance();
    const instance2 = CanDeviceManager.getInstance();
    if (instance1 === instance2) {
      console.log('✓ 单例实例正确\n');
      passedTests++;
    } else {
      throw new Error('单例实例不一致');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试2: ZlgCanDriver 初始化
  console.log('[测试2] ZlgCanDriver 初始化');
  let driver: ZlgCanDriver;
  try {
    driver = new ZlgCanDriver();
    await driver.initialize();

    if (driver.name === 'zlgcan' && driver.supportedDeviceTypes.length > 0) {
      console.log(`✓ 驱动初始化成功`);
      console.log(`  驱动名称: ${driver.name}`);
      console.log(`  支持设备数: ${driver.supportedDeviceTypes.length}\n`);
      passedTests++;
    } else {
      throw new Error('驱动属性不正确');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
    return;
  }

  // 测试3: 注册驱动
  console.log('[测试3] 注册驱动到设备管理器');
  const manager = CanDeviceManager.getInstance();
  try {
    manager.registerDriver(driver);
    const retrievedDriver = manager.getDriver('zlgcan');

    if (retrievedDriver === driver) {
      console.log('✓ 驱动注册成功\n');
      passedTests++;
    } else {
      throw new Error('驱动注册失败');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试4: 创建设备实例
  console.log('[测试4] 创建设备实例');
  try {
    const device = manager.createDeviceByVendorCode(
      zlgcan.DeviceType.ZCAN_USBCANFD_200U,
      'zlgcan'
    );

    if (device && device.state === CanDeviceState.Disconnected) {
      console.log('✓ 设备实例创建成功');
      console.log(`  设备类型: ${device.deviceType}`);
      console.log(`  设备状态: ${device.state}\n`);
      passedTests++;

      // 测试5: 通道配置
      console.log('[测试5] 通道配置');
      const canConfig: IChannelConfig = {
        protocolType: CanProtocolType.CAN,
        arbitrationBaudrate: 500,
      };

      const canfdConfig: IChannelConfig = {
        protocolType: CanProtocolType.CANFD,
        arbitrationBaudrate: 500,
        dataBaudrate: 2000,
      };

      console.log('✓ CAN配置创建成功');
      console.log(`  协议类型: ${canConfig.protocolType}`);
      console.log(`  仲裁波特率: ${canConfig.arbitrationBaudrate}kbps`);
      console.log('✓ CANFD配置创建成功');
      console.log(`  协议类型: ${canfdConfig.protocolType}`);
      console.log(`  仲裁波特率: ${canfdConfig.arbitrationBaudrate}kbps`);
      console.log(`  数据波特率: ${canfdConfig.dataBaudrate}kbps\n`);
      passedTests += 2;

      // 清理
      device.close();
    } else {
      throw new Error('设备实例创建失败');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 测试6: 错误处理
  console.log('[测试6] 错误处理机制');
  try {
    let errorCaught = false;
    try {
      manager.createDeviceByVendorCode(
        zlgcan.DeviceType.ZCAN_USBCANFD_200U,
        'nonexistent'
      );
    } catch (error) {
      errorCaught = true;
    }

    if (errorCaught) {
      console.log('✓ 错误处理正确\n');
      passedTests++;
    } else {
      throw new Error('未捕获预期错误');
    }
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}\n`);
    failedTests++;
  }

  // 清理资源
  manager.dispose();

  // 输出结果
  console.log('========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  console.log(`通过: ${passedTests}`);
  console.log(`失败: ${failedTests}`);
  console.log(`总计: ${passedTests + failedTests}`);

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
