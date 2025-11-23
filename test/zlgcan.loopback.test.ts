/**
 * ZLG CAN 设备测试代码 - 自发自收模式 (Loopback Mode)
 * 测试设备: ZCAN_USBCANFD_200U
 * 测试模式: 自发自收 (同一通道发送并接收)
 * 说明: 自发自收模式下，发送的数据会被同一通道接收回来，不需要物理连接
 */

import { ZlgCanDevice, DeviceType, CanType, CanFDFrame, ReceivedFDFrame, CanChannelConfig } from '../src/zlgcan';

// 测试配置 - 自发自收模式
const TEST_CONFIG = {
    deviceType: DeviceType.ZCAN_USBCANFD_200U,
    deviceIndex: 0,
    // CANFD配置 - mode=2 表示自发自收模式
    canfdConfig: {
        canType: CanType.TYPE_CANFD,
        accCode: 0,
        accMask: 0xFFFFFFFF,
        abitTiming: 0x00016D01,  // 仲裁段波特率
        dbitTiming: 0x00016D01,  // 数据段波特率
        brp: 0,
        filter: 0,
        mode: 2,  // 自发自收模式 (Loopback)
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

function formatFrame(frame: CanFDFrame | ReceivedFDFrame): string {
    const len = 'len' in frame ? frame.len : 8;
    const dataStr = frame.data.slice(0, len).map(d => '0x' + d.toString(16).padStart(2, '0')).join(', ');
    return `ID=0x${frame.id.toString(16).padStart(3, '0')}, LEN=${len}, Data=[${dataStr}]`;
}

function compareFrames(sent: CanFDFrame, received: ReceivedFDFrame): boolean {
    if (sent.id !== received.id) return false;
    if (sent.len !== received.len) return false;
    for (let i = 0; i < sent.len; i++) {
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
 * 测试3: 初始化通道 (自发自收模式)
 */
function testInitChannel(device: ZlgCanDevice, channelIndex: number): number {
    console.log(`\n--- 测试3: 初始化通道${channelIndex} (自发自收模式) ---`);
    try {
        console.log(`  配置: mode=${TEST_CONFIG.canfdConfig.mode} (自发自收)`);
        const ch = device.initCanChannel(channelIndex, TEST_CONFIG.canfdConfig);
        const success = ch !== 0;
        logTest(`初始化通道${channelIndex}`, success, success ? `句柄: ${ch}` : '初始化失败');
        return ch;
    } catch (error) {
        logTest(`初始化通道${channelIndex}`, false, `异常: ${error}`);
        return 0;
    }
}

/**
 * 测试4: 启动通道
 */
function testStartChannel(device: ZlgCanDevice, channelHandle: number, channelIndex: number): boolean {
    console.log(`\n--- 测试4: 启动通道${channelIndex} ---`);
    try {
        const result = device.startCanChannel(channelHandle);
        logTest(`启动通道${channelIndex}`, result, result ? '启动成功' : '启动失败');
        return result;
    } catch (error) {
        logTest(`启动通道${channelIndex}`, false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试5: 自发自收测试 - 通道0
 */
async function testLoopbackCh0(device: ZlgCanDevice, ch0: number): Promise<boolean> {
    console.log('\n--- 测试5: 通道0自发自收测试 (CANFD) ---');
    try {
        const testFrame: CanFDFrame = {
            id: 0x100,
            len: 8,
            data: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
            flags: 0,
            transmitType: 0,
        };

        console.log(`  发送: ${formatFrame(testFrame)}`);
        const sendResult = device.transmitFD(ch0, testFrame);
        if (sendResult <= 0) {
            logTest('CH0 自发自收 - 发送', false, `发送失败, 返回值: ${sendResult}`);
            return false;
        }
        logTest('CH0 自发自收 - 发送', true, `发送成功, 返回值: ${sendResult}`);

        // 等待数据传输
        await sleep(100);

        // 在同一通道接收
        const received = device.receiveFD(ch0, 10, 200);
        if (received.length === 0) {
            logTest('CH0 自发自收 - 接收', false, '未接收到数据');
            return false;
        }

        console.log(`  接收: ${formatFrame(received[0])}`);
        const match = compareFrames(testFrame, received[0]);
        logTest('CH0 自发自收 - 数据校验', match, match ? '数据一致' : '数据不一致');
        return match;
    } catch (error) {
        logTest('CH0 自发自收测试', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试6: 自发自收测试 - 通道1
 */
async function testLoopbackCh1(device: ZlgCanDevice, ch1: number): Promise<boolean> {
    console.log('\n--- 测试6: 通道1自发自收测试 (CANFD) ---');
    try {
        const testFrame: CanFDFrame = {
            id: 0x200,
            len: 8,
            data: [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22],
            flags: 0,
            transmitType: 0,
        };

        console.log(`  发送: ${formatFrame(testFrame)}`);
        const sendResult = device.transmitFD(ch1, testFrame);
        if (sendResult <= 0) {
            logTest('CH1 自发自收 - 发送', false, `发送失败, 返回值: ${sendResult}`);
            return false;
        }
        logTest('CH1 自发自收 - 发送', true, `发送成功, 返回值: ${sendResult}`);

        // 等待数据传输
        await sleep(100);

        // 在同一通道接收
        const received = device.receiveFD(ch1, 10, 200);
        if (received.length === 0) {
            logTest('CH1 自发自收 - 接收', false, '未接收到数据');
            return false;
        }

        console.log(`  接收: ${formatFrame(received[0])}`);
        const match = compareFrames(testFrame, received[0]);
        logTest('CH1 自发自收 - 数据校验', match, match ? '数据一致' : '数据不一致');
        return match;
    } catch (error) {
        logTest('CH1 自发自收测试', false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试7: 批量自发自收测试
 */
async function testBatchLoopback(device: ZlgCanDevice, ch: number, channelIndex: number): Promise<boolean> {
    console.log(`\n--- 测试7: 通道${channelIndex}批量自发自收测试 (CANFD) ---`);
    try {
        const frameCount = 10;
        let sendSuccess = 0;

        for (let i = 0; i < frameCount; i++) {
            const frame: CanFDFrame = {
                id: 0x300 + i,
                len: 8,
                data: [i, i + 1, i + 2, i + 3, i + 4, i + 5, i + 6, i + 7],
                flags: 0,
                transmitType: 0,
            };
            const result = device.transmitFD(ch, frame);
            if (result > 0) sendSuccess++;
        }

        console.log(`  发送: ${sendSuccess}/${frameCount} 帧成功`);

        await sleep(200);

        const received = device.receiveFD(ch, 20, 300);
        const successCount = received.length;

        console.log(`  接收: ${successCount} 帧`);

        const success = successCount === frameCount;
        logTest(`通道${channelIndex}批量自发自收`, success, `${successCount}/${frameCount} 帧接收成功`);
        return success;
    } catch (error) {
        logTest(`通道${channelIndex}批量自发自收`, false, `异常: ${error}`);
        return false;
    }
}

/**
 * 测试8: CANFD长数据帧自发自收测试 (64字节)
 */
async function testLongFrameLoopback(device: ZlgCanDevice, ch: number, channelIndex: number): Promise<boolean> {
    console.log(`\n--- 测试8: 通道${channelIndex} CANFD长数据帧自发自收测试 (64字节) ---`);
    try {
        const data64: number[] = [];
        for (let i = 0; i < 64; i++) {
            data64.push(i);
        }

        const testFrame: CanFDFrame = {
            id: 0x500,
            len: 64,
            data: data64,
            flags: 0,
            transmitType: 0,
        };

        console.log(`  发送: ID=0x${testFrame.id.toString(16)}, LEN=${testFrame.len}`);
        const sendResult = device.transmitFD(ch, testFrame);
        if (sendResult <= 0) {
            logTest(`通道${channelIndex} 64字节帧发送`, false, `发送失败, 返回值: ${sendResult}`);
            return false;
        }
        logTest(`通道${channelIndex} 64字节帧发送`, true, `发送成功`);

        await sleep(100);

        const received = device.receiveFD(ch, 10, 200);
        if (received.length === 0) {
            logTest(`通道${channelIndex} 64字节帧接收`, false, '未接收到数据');
            return false;
        }

        console.log(`  接收: ID=0x${received[0].id.toString(16)}, LEN=${received[0].len}`);
        const match = compareFrames(testFrame, received[0]);
        logTest(`通道${channelIndex} 64字节帧校验`, match, match ? '数据一致' : '数据不一致');
        return match;
    } catch (error) {
        logTest(`通道${channelIndex} 64字节帧测试`, false, `异常: ${error}`);
        return false;
    }
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
    console.log('    模式: 自发自收 (Loopback)');
    console.log('    说明: 同一通道发送并接收，不需要物理连接');
    console.log('============================================');
    console.log(`设备类型ID: ${TEST_CONFIG.deviceType}`);
    console.log(`设备索引: ${TEST_CONFIG.deviceIndex}`);
    console.log(`工作模式: ${TEST_CONFIG.canfdConfig.mode} (自发自收)`);

    const device = new ZlgCanDevice();

    // 测试1: 打开设备
    if (!testOpenDevice(device)) {
        console.log('\n设备打开失败，终止测试');
        printSummary();
        return;
    }

    // 测试2: 获取设备信息
    testGetDeviceInfo(device);

    // 测试3: 初始化通道0 (自发自收模式)
    const ch0 = testInitChannel(device, 0);
    if (ch0 === 0) {
        console.log('\n通道0初始化失败，终止测试');
        testCloseDevice(device);
        printSummary();
        return;
    }

    // 测试3续: 初始化通道1 (自发自收模式)
    const ch1 = testInitChannel(device, 1);
    if (ch1 === 0) {
        console.log('\n通道1初始化失败，终止测试');
        testCloseDevice(device);
        printSummary();
        return;
    }

    // 测试4: 启动通道0
    if (!testStartChannel(device, ch0, 0)) {
        console.log('\n通道0启动失败，终止测试');
        testCloseDevice(device);
        printSummary();
        return;
    }

    // 测试4续: 启动通道1
    if (!testStartChannel(device, ch1, 1)) {
        console.log('\n通道1启动失败，终止测试');
        testCloseDevice(device);
        printSummary();
        return;
    }

    // 测试5: 通道0自发自收
    await testLoopbackCh0(device, ch0);

    // 测试6: 通道1自发自收
    await testLoopbackCh1(device, ch1);

    // 测试7: 通道0批量自发自收
    await testBatchLoopback(device, ch0, 0);

    // 测试8: 通道0 64字节长帧自发自收
    await testLongFrameLoopback(device, ch0, 0);

    // 测试9: 关闭设备
    testCloseDevice(device);

    // 打印测试摘要
    printSummary();
}

// 运行测试
runAllTests().catch(console.error);
