/**
 * ZLG CAN 设备测试代码
 * 测试设备: ZCAN_USBCANFD_200U
 * 连接拓扑: 通道0 <-> 通道1 (两通道物理连接)
 * 测试内容: 打开设备、初始化通道、双通道收发、回调接收、关闭设备
 */

import { ZlgCanDevice, DeviceType, CanType, CanFrame, ReceivedFrame, CanChannelConfig } from '../src/zlgcan';

// 测试配置
const TEST_CONFIG = {
    deviceType: DeviceType.ZCAN_USBCANFD_200U,
    deviceIndex: 0,
    // CANFD配置 (仲裁域500Kbps, 数据域2Mbps)
    canfdConfig: {
        canType: CanType.TYPE_CANFD,
        accCode: 0,
        accMask: 0xFFFFFFFF,
        abitTiming: 0x00016D01,  // 500Kbps
        dbitTiming: 0x00016D01,  // 2Mbps
        brp: 0,
        filter: 0,
        mode: 0,
        pad: 0,
        reserved: 0,
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
    const status = passed ? '[PASS]' : '[FAIL]';
    console.log(`${status} ${name}: ${message}`);
}

function formatFrame(frame: CanFrame | ReceivedFrame): string {
    const dataStr = frame.data.map(d => '0x' + d.toString(16).padStart(2, '0')).join(', ');
    return `ID=0x${frame.id.toString(16).padStart(3, '0')}, DLC=${frame.dlc}, Data=[${dataStr}]`;
}

function compareFrames(sent: CanFrame, received: ReceivedFrame): boolean {
    if (sent.id !== received.id) return false;
    if (sent.dlc !== received.dlc) return false;
    for (let i = 0; i < sent.dlc; i++) {
        if (sent.data[i] !== received.data[i]) return false;
    }
    return true;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试1: 打开设备
 */
function testOpenDevice(device: ZlgCanDevice): boolean {
    console.log('\n--- 测试1: 打开设备 ---');
    try {
        const result = device.openDevice(TEST_CONFIG.deviceType, TEST_CONFIG.deviceIndex, 0);
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
        console.log('  设备信息:');
        console.log(`    硬件版本: ${info.hardwareVersion}`);
        console.log(`    固件版本: ${info.firmwareVersion}`);
        console.log(`    驱动版本: ${info.driverVersion}`);
        console.log(`    库版本: ${info.libraryVersion}`);
        console.log(`    CAN通道数: ${info.canNumber}`);
        console.log(`    序列号: ${info.serialNumber}`);
        console.log(`    硬件类型: ${info.hardwareType}`);
        logTest('获取设备信息', true, '成功获取设备信息');
        return true;
    } catch (error) {
        logTest('获取设备信息', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试3: 初始化双通道
 */
function testInitChannels(device: ZlgCanDevice): { ch0: number; ch1: number } | null {
    console.log('\n--- 测试3: 初始化双通道 ---');
    try {
        const ch0 = device.initCanChannel(0, TEST_CONFIG.canfdConfig);
        const ch0Success = ch0 !== 0;
        logTest('初始化通道0', ch0Success, ch0Success ? `句柄: ${ch0}` : '初始化失败');

        const ch1 = device.initCanChannel(1, TEST_CONFIG.canfdConfig);
        const ch1Success = ch1 !== 0;
        logTest('初始化通道1', ch1Success, ch1Success ? `句柄: ${ch1}` : '初始化失败');

        if (ch0Success && ch1Success) {
            return { ch0, ch1 };
        }
        return null;
    } catch (error) {
        logTest('初始化通道', false, `异常: ${error}`);
        return null;
    }
}

/**
 * 测试4: 启动双通道
 */
function testStartChannels(device: ZlgCanDevice, ch0: number, ch1: number): boolean {
    console.log('\n--- 测试4: 启动双通道 ---');
    try {
        const result0 = device.startCanChannel(ch0);
        logTest('启动通道0', result0, result0 ? '启动成功' : '启动失败');

        const result1 = device.startCanChannel(ch1);
        logTest('启动通道1', result1, result1 ? '启动成功' : '启动失败');

        return result0 && result1;
    } catch (error) {
        logTest('启动通道', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试5: 通道0发送 -> 通道1接收
 */
async function testCh0ToCh1(device: ZlgCanDevice, ch0: number, ch1: number): Promise<boolean> {
    console.log('\n--- 测试5: 通道0发送 -> 通道1接收 ---');
    try {
        const testFrame: CanFrame = {
            id: 0x100,
            dlc: 8,
            data: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
            transmitType: 0,
        };

        console.log(`  发送: ${formatFrame(testFrame)}`);
        const sendResult = device.transmit(ch0, testFrame);
        if (sendResult <= 0) {
            logTest('CH0->CH1 发送', false, '发送失败');
            return false;
        }

        // 等待数据传输
        await sleep(50);

        const received = device.receive(ch1, 10, 100);
        if (received.length === 0) {
            logTest('CH0->CH1 接收', false, '未接收到数据');
            return false;
        }

        console.log(`  接收: ${formatFrame(received[0])}`);
        const match = compareFrames(testFrame, received[0]);
        logTest('CH0->CH1 数据校验', match, match ? '数据一致' : '数据不一致');
        return match;
    } catch (error) {
        logTest('CH0->CH1 测试', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试6: 通道1发送 -> 通道0接收
 */
async function testCh1ToCh0(device: ZlgCanDevice, ch0: number, ch1: number): Promise<boolean> {
    console.log('\n--- 测试6: 通道1发送 -> 通道0接收 ---');
    try {
        const testFrame: CanFrame = {
            id: 0x200,
            dlc: 8,
            data: [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22],
            transmitType: 0,
        };

        console.log(`  发送: ${formatFrame(testFrame)}`);
        const sendResult = device.transmit(ch1, testFrame);
        if (sendResult <= 0) {
            logTest('CH1->CH0 发送', false, '发送失败');
            return false;
        }

        // 等待数据传输
        await sleep(50);

        const received = device.receive(ch0, 10, 100);
        if (received.length === 0) {
            logTest('CH1->CH0 接收', false, '未接收到数据');
            return false;
        }

        console.log(`  接收: ${formatFrame(received[0])}`);
        const match = compareFrames(testFrame, received[0]);
        logTest('CH1->CH0 数据校验', match, match ? '数据一致' : '数据不一致');
        return match;
    } catch (error) {
        logTest('CH1->CH0 测试', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试7: 批量发送测试
 */
async function testBatchTransmit(device: ZlgCanDevice, ch0: number, ch1: number): Promise<boolean> {
    console.log('\n--- 测试7: 批量发送测试 ---');
    try {
        const frameCount = 10;
        let successCount = 0;

        for (let i = 0; i < frameCount; i++) {
            const frame: CanFrame = {
                id: 0x300 + i,
                dlc: 8,
                data: [i, i + 1, i + 2, i + 3, i + 4, i + 5, i + 6, i + 7],
                transmitType: 0,
            };
            device.transmit(ch0, frame);
        }

        await sleep(100);

        const received = device.receive(ch1, 20, 200);
        successCount = received.length;

        console.log(`  发送: ${frameCount} 帧`);
        console.log(`  接收: ${successCount} 帧`);

        const success = successCount === frameCount;
        logTest('批量发送', success, `${successCount}/${frameCount} 帧接收成功`);
        return success;
    } catch (error) {
        logTest('批量发送', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试8: 回调接收测试
 */
async function testCallbackReceive(device: ZlgCanDevice, ch0: number, ch1: number): Promise<boolean> {
    console.log('\n--- 测试8: 回调接收测试 ---');

    return new Promise(async (resolve) => {
        try {
            let receivedFrames: ReceivedFrame[] = [];
            const expectedCount = 5;

            const callback = (frames: ReceivedFrame[]) => {
                receivedFrames = receivedFrames.concat(frames);
                console.log(`  [回调] 接收到 ${frames.length} 帧, 累计: ${receivedFrames.length}`);
            };

            const setResult = device.setReceiveCallback(ch0, callback);
            if (!setResult) {
                logTest('设置回调', false, '设置失败');
                resolve(false);
                return;
            }
            logTest('设置回调', true, '通道0回调已设置');

            // 从通道1发送数据
            console.log(`  从通道1发送 ${expectedCount} 帧...`);
            for (let i = 0; i < expectedCount; i++) {
                const frame: CanFrame = {
                    id: 0x400 + i,
                    dlc: 4,
                    data: [0xCA, 0x11, 0xBA, 0xC0 + i, 0, 0, 0, 0],
                    transmitType: 0,
                };
                device.transmit(ch1, frame);
                await sleep(20);
            }

            // 等待回调处理
            await sleep(500);

            device.clearReceiveCallback(ch0);
            console.log('  回调已清除');

            const success = receivedFrames.length >= expectedCount;
            logTest('回调接收', success, `接收 ${receivedFrames.length}/${expectedCount} 帧`);
            resolve(success);
        } catch (error) {
            logTest('回调接收', false, `异常: ${error}`);
            resolve(false);
        }
    });
}

/**
 * 测试9: 关闭设备
 */
function testCloseDevice(device: ZlgCanDevice): boolean {
    console.log('\n--- 测试9: 关闭设备 ---');
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
    console.log('\n============ 测试摘要 ============');
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;

    testResults.forEach(result => {
        const status = result.passed ? '[PASS]' : '[FAIL]';
        console.log(`  ${status} ${result.name}`);
    });

    console.log('----------------------------------');
    console.log(`  通过: ${passed}  失败: ${failed}  总计: ${testResults.length}`);
    console.log('==================================');

    if (failed > 0) {
        process.exit(1);
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('============================================');
    console.log('    ZLG CAN 设备测试 - USBCANFD-200U');
    console.log('    连接拓扑: 通道0 <-> 通道1');
    console.log('============================================');
    console.log(`设备类型ID: ${TEST_CONFIG.deviceType}`);
    console.log(`设备索引: ${TEST_CONFIG.deviceIndex}`);

    const device = new ZlgCanDevice();

    // 测试1: 打开设备
    if (!testOpenDevice(device)) {
        console.log('\n设备打开失败，终止测试');
        printSummary();
        return;
    }

    // 测试2: 获取设备信息
    testGetDeviceInfo(device);

    // 测试3: 初始化双通道
    const channels = testInitChannels(device);
    if (!channels) {
        console.log('\n通道初始化失败，终止测试');
        testCloseDevice(device);
        printSummary();
        return;
    }

    // 测试4: 启动双通道
    if (!testStartChannels(device, channels.ch0, channels.ch1)) {
        console.log('\n通道启动失败，终止测试');
        testCloseDevice(device);
        printSummary();
        return;
    }

    // 测试5: 通道0 -> 通道1
    await testCh0ToCh1(device, channels.ch0, channels.ch1);

    // 测试6: 通道1 -> 通道0
    await testCh1ToCh0(device, channels.ch0, channels.ch1);

    // 测试7: 批量发送
    await testBatchTransmit(device, channels.ch0, channels.ch1);

    // 测试8: 回调接收
    await testCallbackReceive(device, channels.ch0, channels.ch1);

    // 测试9: 关闭设备
    testCloseDevice(device);

    // 打印测试摘要
    printSummary();
}

// 运行测试
runAllTests().catch(console.error);
