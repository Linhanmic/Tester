/**
 * ZLG CAN 设备测试代码
 * 测试基本功能：打开设备、打开通道、发送报文、接收报文、关闭通道、关闭设备
 */

import { ZlgCanDevice, DeviceType, CanType, CanFrame, ReceivedFrame, CanChannelConfig } from '../src/zlgcan';

// 测试配置
const TEST_CONFIG = {
    deviceType: DeviceType.ZCAN_USBCANFD_200U,  // 根据实际设备修改
    deviceIndex: 0,
    channelIndex: 0,
    // CAN配置 (250Kbps)
    canConfig: {
        canType: CanType.TYPE_CAN,
        accCode: 0,
        accMask: 0xFFFFFFFF,
        reserved: 0,
        filter: 0,
        timing0: 0x01,  // 250Kbps
        timing1: 0x1C,
        mode: 0,  // 正常模式
    } as CanChannelConfig,
};

// 测试结果记录
interface TestResult {
    name: string;
    passed: boolean;
    message: string;
}

const testResults: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string) {
    testResults.push({ name, passed, message });
    const status = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${status}] ${name}: ${message}`);
}

/**
 * 测试1: 打开设备
 */
function testOpenDevice(device: ZlgCanDevice): boolean {
    console.log('\n--- 测试1: 打开设备 ---');
    try {
        const result = device.openDevice(
            TEST_CONFIG.deviceType,
            TEST_CONFIG.deviceIndex,
            0
        );
        logTest('打开设备', result, result ? '设备打开成功' : '设备打开失败');
        return result;
    } catch (error) {
        logTest('打开设备', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试2: 获取设备信息
 */
function testGetDeviceInfo(device: ZlgCanDevice): boolean {
    console.log('\n--- 测试2: 获取设备信息 ---');
    try {
        const info = device.getDeviceInfo();
        console.log('设备信息:');
        console.log(`  硬件版本: ${info.hardwareVersion}`);
        console.log(`  固件版本: ${info.firmwareVersion}`);
        console.log(`  驱动版本: ${info.driverVersion}`);
        console.log(`  库版本: ${info.libraryVersion}`);
        console.log(`  CAN通道数: ${info.canNumber}`);
        console.log(`  序列号: ${info.serialNumber}`);
        console.log(`  硬件类型: ${info.hardwareType}`);
        logTest('获取设备信息', true, '成功获取设备信息');
        return true;
    } catch (error) {
        logTest('获取设备信息', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试3: 初始化CAN通道
 */
function testInitCanChannel(device: ZlgCanDevice): number {
    console.log('\n--- 测试3: 初始化CAN通道 ---');
    try {
        const channelHandle = device.initCanChannel(
            TEST_CONFIG.channelIndex,
            TEST_CONFIG.canConfig
        );
        const success = channelHandle !== 0;
        logTest('初始化CAN通道', success, success ? `通道句柄: ${channelHandle}` : '初始化失败');
        return channelHandle;
    } catch (error) {
        logTest('初始化CAN通道', false, `异常: ${error}`);
        return 0;
    }
}

/**
 * 测试4: 启动CAN通道
 */
function testStartCanChannel(device: ZlgCanDevice, channelHandle: number): boolean {
    console.log('\n--- 测试4: 启动CAN通道 ---');
    try {
        const result = device.startCanChannel(channelHandle);
        logTest('启动CAN通道', result, result ? '通道启动成功' : '通道启动失败');
        return result;
    } catch (error) {
        logTest('启动CAN通道', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试5: 发送CAN报文
 */
function testTransmit(device: ZlgCanDevice, channelHandle: number): boolean {
    console.log('\n--- 测试5: 发送CAN报文 ---');
    try {
        const frame: CanFrame = {
            id: 0x123,
            dlc: 8,
            data: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
            transmitType: 0,
        };

        console.log(`发送帧: ID=0x${frame.id.toString(16)}, DLC=${frame.dlc}, Data=[${frame.data.map(d => '0x' + d.toString(16).padStart(2, '0')).join(', ')}]`);

        const result = device.transmit(channelHandle, frame);
        const success = result > 0;
        logTest('发送CAN报文', success, success ? `成功发送 ${result} 帧` : '发送失败');
        return success;
    } catch (error) {
        logTest('发送CAN报文', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试6: 接收CAN报文 (非阻塞)
 */
function testReceive(device: ZlgCanDevice, channelHandle: number): boolean {
    console.log('\n--- 测试6: 接收CAN报文 ---');
    try {
        // 非阻塞接收，等待100ms
        const frames = device.receive(channelHandle, 10, 100);

        if (frames.length > 0) {
            console.log(`接收到 ${frames.length} 帧:`);
            frames.forEach((frame, index) => {
                console.log(`  帧${index + 1}: ID=0x${frame.id.toString(16)}, DLC=${frame.dlc}, Timestamp=${frame.timestamp}`);
                console.log(`         Data=[${frame.data.map(d => '0x' + d.toString(16).padStart(2, '0')).join(', ')}]`);
            });
            logTest('接收CAN报文', true, `成功接收 ${frames.length} 帧`);
        } else {
            console.log('未接收到报文 (这可能是正常的，如果没有外部设备发送数据)');
            logTest('接收CAN报文', true, '接收功能正常，但无数据');
        }
        return true;
    } catch (error) {
        logTest('接收CAN报文', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试7: 设置接收回调
 */
function testReceiveCallback(device: ZlgCanDevice, channelHandle: number): Promise<boolean> {
    console.log('\n--- 测试7: 设置接收回调 ---');
    return new Promise((resolve) => {
        try {
            let receivedCount = 0;

            const callback = (frames: ReceivedFrame[]) => {
                receivedCount += frames.length;
                console.log(`[回调] 接收到 ${frames.length} 帧, 总计: ${receivedCount}`);
                frames.forEach((frame, index) => {
                    console.log(`  帧: ID=0x${frame.id.toString(16)}, DLC=${frame.dlc}`);
                });
            };

            const result = device.setReceiveCallback(channelHandle, callback);
            logTest('设置接收回调', result, result ? '回调设置成功' : '回调设置失败');

            if (result) {
                console.log('等待2秒接收数据...');
                setTimeout(() => {
                    device.clearReceiveCallback(channelHandle);
                    console.log('回调已清除');
                    resolve(true);
                }, 2000);
            } else {
                resolve(false);
            }
        } catch (error) {
            logTest('设置接收回调', false, `异常: ${error}`);
            resolve(false);
        }
    });
}

/**
 * 测试8: 关闭设备
 */
function testCloseDevice(device: ZlgCanDevice): boolean {
    console.log('\n--- 测试8: 关闭设备 ---');
    try {
        const result = device.closeDevice();
        logTest('关闭设备', result, result ? '设备关闭成功' : '设备关闭失败');
        return result;
    } catch (error) {
        logTest('关闭设备', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 打印测试摘要
 */
function printSummary() {
    console.log('\n========== 测试摘要 ==========');
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;

    testResults.forEach(result => {
        const status = result.passed ? '✓' : '✗';
        console.log(`  ${status} ${result.name}`);
    });

    console.log(`\n总计: ${passed} 通过, ${failed} 失败`);
    console.log('================================');
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('========== ZLG CAN 设备测试 ==========');
    console.log(`设备类型: ${TEST_CONFIG.deviceType}`);
    console.log(`设备索引: ${TEST_CONFIG.deviceIndex}`);
    console.log(`通道索引: ${TEST_CONFIG.channelIndex}`);
    console.log('=======================================\n');

    const device = new ZlgCanDevice();

    // 测试1: 打开设备
    if (!testOpenDevice(device)) {
        console.log('\n设备打开失败，终止测试');
        printSummary();
        return;
    }

    // 测试2: 获取设备信息
    testGetDeviceInfo(device);

    // 测试3: 初始化CAN通道
    const channelHandle = testInitCanChannel(device);
    if (channelHandle === 0) {
        console.log('\n通道初始化失败，跳过后续测试');
        testCloseDevice(device);
        printSummary();
        return;
    }

    // 测试4: 启动CAN通道
    if (!testStartCanChannel(device, channelHandle)) {
        console.log('\n通道启动失败，跳过后续测试');
        testCloseDevice(device);
        printSummary();
        return;
    }

    // 测试5: 发送CAN报文
    testTransmit(device, channelHandle);

    // 测试6: 接收CAN报文
    testReceive(device, channelHandle);

    // 测试7: 设置接收回调
    await testReceiveCallback(device, channelHandle);

    // 测试8: 关闭设备
    testCloseDevice(device);

    // 打印测试摘要
    printSummary();
}

// 运行测试
runAllTests().catch(console.error);
