/**
 * 波特率配置测试
 * 使用新的baudrate模块进行配置测试
 * 支持CodeLens代码透视执行
 */

import {
    ZlgCanDevice,
    DeviceType,
    CanFDFrame,
    ReceivedFDFrame,
    // 波特率配置模块
    ArbitrationBaudRate,
    DataBaudRate,
    Protocol,
    CanfdStandard,
    CanfdAcceleration,
    WorkMode,
    TerminalResistance,
    BusUsageReport,
    TxRetryPolicy,
    DEFAULT_CANFD_CONFIG,
    ConfigPresets,
    configureChannelWithSetValue,
    getChannelConfig,
    quickInitChannel,
    formatBaudRate,
    getConfigSummary,
    ChannelConfigOptions,
} from '../src/zlgcan';

// ============================================================================
// 测试配置
// ============================================================================

const TEST_CONFIG = {
    deviceType: DeviceType.ZCAN_USBCANFD_200U,
    deviceIndex: 0,
};

// ============================================================================
// 测试工具函数
// ============================================================================

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    duration?: number;
}

const testResults: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string, duration?: number) {
    testResults.push({ name, passed, message, duration });
    const status = passed ? '[PASS]' : '[FAIL]';
    const timeStr = duration !== undefined ? ` (${duration}ms)` : '';
    console.log(`${status} ${name}: ${message}${timeStr}`);
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

// ============================================================================
// 测试用例
// ============================================================================

/**
 * @test 测试默认配置常量
 * @description 验证DEFAULT_CANFD_CONFIG包含正确的默认值
 */
export function testDefaultConfig(): boolean {
    console.log('\n--- 测试: 默认配置常量 ---');

    const checks = [
        { name: '协议', value: DEFAULT_CANFD_CONFIG.protocol, expected: Protocol.CANFD },
        { name: 'CANFD标准', value: DEFAULT_CANFD_CONFIG.canfdStandard, expected: CanfdStandard.ISO },
        { name: 'CANFD加速', value: DEFAULT_CANFD_CONFIG.canfdAcceleration, expected: CanfdAcceleration.ENABLED },
        { name: '仲裁域波特率', value: DEFAULT_CANFD_CONFIG.arbitrationBaudRate, expected: ArbitrationBaudRate.BAUD_500K },
        { name: '数据域波特率', value: DEFAULT_CANFD_CONFIG.dataBaudRate, expected: DataBaudRate.BAUD_2M },
        { name: '工作模式', value: DEFAULT_CANFD_CONFIG.workMode, expected: WorkMode.NORMAL },
        { name: '终端电阻', value: DEFAULT_CANFD_CONFIG.terminalResistance, expected: TerminalResistance.ENABLED },
        { name: '总线利用率上报', value: DEFAULT_CANFD_CONFIG.busUsageReport, expected: BusUsageReport.DISABLED },
        { name: '发送重试策略', value: DEFAULT_CANFD_CONFIG.txRetryPolicy, expected: TxRetryPolicy.TILL_BUSOFF },
    ];

    let allPassed = true;
    for (const check of checks) {
        const passed = check.value === check.expected;
        if (!passed) {
            console.log(`  [FAIL] ${check.name}: 期望 ${check.expected}, 实际 ${check.value}`);
            allPassed = false;
        } else {
            console.log(`  [OK] ${check.name}: ${check.value}`);
        }
    }

    logTest('默认配置常量', allPassed, allPassed ? '所有默认值正确' : '部分默认值不正确');
    return allPassed;
}

/**
 * @test 测试配置预设
 * @description 验证ConfigPresets包含所有预期的配置预设
 */
export function testConfigPresets(): boolean {
    console.log('\n--- 测试: 配置预设 ---');

    const presets = [
        { name: 'CANFD_500K_2M', expected: { abit: 500000, dbit: 2000000 } },
        { name: 'CANFD_1M_5M', expected: { abit: 1000000, dbit: 5000000 } },
        { name: 'CANFD_1M_4M', expected: { abit: 1000000, dbit: 4000000 } },
        { name: 'CANFD_500K_4M', expected: { abit: 500000, dbit: 4000000 } },
        { name: 'CANFD_250K_1M', expected: { abit: 250000, dbit: 1000000 } },
        { name: 'CAN_500K', expected: { abit: 500000, dbit: 500000 } },
        { name: 'CAN_1M', expected: { abit: 1000000, dbit: 1000000 } },
        { name: 'CAN_125K', expected: { abit: 125000, dbit: 125000 } },
    ];

    let allPassed = true;
    for (const preset of presets) {
        const config = ConfigPresets[preset.name as keyof typeof ConfigPresets];
        const abitMatch = config.arbitrationBaudRate === preset.expected.abit;
        const dbitMatch = config.dataBaudRate === preset.expected.dbit;
        const passed = abitMatch && dbitMatch;

        if (!passed) {
            console.log(`  [FAIL] ${preset.name}: 波特率不匹配`);
            allPassed = false;
        } else {
            console.log(`  [OK] ${preset.name}: ${formatBaudRate(preset.expected.abit)}/${formatBaudRate(preset.expected.dbit)}`);
        }
    }

    logTest('配置预设', allPassed, allPassed ? '所有预设正确' : '部分预设不正确');
    return allPassed;
}

/**
 * @test 测试波特率格式化
 * @description 验证formatBaudRate函数正确格式化波特率
 */
export function testFormatBaudRate(): boolean {
    console.log('\n--- 测试: 波特率格式化 ---');

    const cases = [
        { value: 5000000, expected: '5Mbps' },
        { value: 2000000, expected: '2Mbps' },
        { value: 1000000, expected: '1Mbps' },
        { value: 500000, expected: '500kbps' },
        { value: 250000, expected: '250kbps' },
        { value: 125000, expected: '125kbps' },
        { value: 100, expected: '100bps' },
    ];

    let allPassed = true;
    for (const c of cases) {
        const result = formatBaudRate(c.value);
        const passed = result === c.expected;
        if (!passed) {
            console.log(`  [FAIL] ${c.value}: 期望 "${c.expected}", 实际 "${result}"`);
            allPassed = false;
        } else {
            console.log(`  [OK] ${c.value} -> ${result}`);
        }
    }

    logTest('波特率格式化', allPassed, allPassed ? '格式化正确' : '部分格式化错误');
    return allPassed;
}

/**
 * @test 测试配置摘要生成
 * @description 验证getConfigSummary函数生成正确的配置摘要
 */
export function testConfigSummary(): boolean {
    console.log('\n--- 测试: 配置摘要生成 ---');

    const summary = getConfigSummary();
    console.log('默认配置摘要:');
    console.log(summary.split('\n').map(line => `  ${line}`).join('\n'));

    const hasProtocol = summary.includes('CAN FD');
    const hasAbit = summary.includes('500kbps');
    const hasDbit = summary.includes('2Mbps');
    const hasTerminal = summary.includes('终端电阻');

    const passed = hasProtocol && hasAbit && hasDbit && hasTerminal;
    logTest('配置摘要生成', passed, passed ? '摘要包含关键信息' : '摘要缺少关键信息');
    return passed;
}

/**
 * @test 测试通道配置对象生成
 * @description 验证getChannelConfig函数生成正确的CanChannelConfig对象
 */
export function testGetChannelConfig(): boolean {
    console.log('\n--- 测试: 通道配置对象生成 ---');

    const config = getChannelConfig();

    console.log('  生成的配置对象:');
    console.log(`    canType: ${config.canType}`);
    console.log(`    accCode: ${config.accCode}`);
    console.log(`    accMask: 0x${config.accMask?.toString(16).toUpperCase()}`);
    console.log(`    mode: ${config.mode}`);

    const passed = config.canType === 1 && config.mode === 0;
    logTest('通道配置对象生成', passed, passed ? '配置对象正确' : '配置对象错误');
    return passed;
}

/**
 * @test 使用默认配置进行设备通信测试
 * @description 使用DEFAULT_CANFD_CONFIG配置设备并测试双通道通信
 * @requires device 需要连接USBCANFD-200U设备
 */
export async function testDefaultConfigCommunication(): Promise<boolean> {
    console.log('\n--- 测试: 默认配置设备通信 ---');
    console.log('使用配置:', getConfigSummary());

    const device = new ZlgCanDevice();

    try {
        // 打开设备
        const openResult = device.openDevice(TEST_CONFIG.deviceType, TEST_CONFIG.deviceIndex, 0);
        if (!openResult) {
            logTest('默认配置通信', false, '设备打开失败');
            return false;
        }
        console.log('  设备打开成功');

        // 使用quickInitChannel初始化通道0
        const ch0 = quickInitChannel(device, 0, DEFAULT_CANFD_CONFIG);
        if (ch0 === 0) {
            logTest('默认配置通信', false, '通道0初始化失败');
            device.closeDevice();
            return false;
        }
        console.log(`  通道0初始化成功, 句柄: ${ch0}`);

        // 使用quickInitChannel初始化通道1
        const ch1 = quickInitChannel(device, 1, DEFAULT_CANFD_CONFIG);
        if (ch1 === 0) {
            logTest('默认配置通信', false, '通道1初始化失败');
            device.closeDevice();
            return false;
        }
        console.log(`  通道1初始化成功, 句柄: ${ch1}`);

        // 启动通道
        device.startCanChannel(ch0);
        device.startCanChannel(ch1);
        console.log('  双通道启动成功');

        // 发送测试帧
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
            logTest('默认配置通信', false, `发送失败, 返回值: ${sendResult}`);
            device.closeDevice();
            return false;
        }

        await sleep(50);

        const received = device.receiveFD(ch1, 10, 100);
        if (received.length === 0) {
            logTest('默认配置通信', false, '未接收到数据');
            device.closeDevice();
            return false;
        }

        console.log(`  接收: ${formatFrame(received[0])}`);
        const match = compareFrames(testFrame, received[0]);

        device.closeDevice();
        logTest('默认配置通信', match, match ? '数据收发正确' : '数据不匹配');
        return match;

    } catch (error) {
        device.closeDevice();
        logTest('默认配置通信', false, `异常: ${error}`);
        return false;
    }
}

/**
 * @test 使用高速配置进行设备通信测试
 * @description 使用1Mbps/5Mbps配置测试高速通信
 * @requires device 需要连接USBCANFD-200U设备
 */
export async function testHighSpeedConfigCommunication(): Promise<boolean> {
    console.log('\n--- 测试: 高速配置设备通信 (1Mbps/5Mbps) ---');

    const config: ChannelConfigOptions = {
        ...ConfigPresets.CANFD_1M_5M,
    };
    console.log('使用配置:', getConfigSummary(config));

    const device = new ZlgCanDevice();

    try {
        const openResult = device.openDevice(TEST_CONFIG.deviceType, TEST_CONFIG.deviceIndex, 0);
        if (!openResult) {
            logTest('高速配置通信', false, '设备打开失败');
            return false;
        }

        const ch0 = quickInitChannel(device, 0, config);
        const ch1 = quickInitChannel(device, 1, config);

        if (ch0 === 0 || ch1 === 0) {
            logTest('高速配置通信', false, '通道初始化失败');
            device.closeDevice();
            return false;
        }

        device.startCanChannel(ch0);
        device.startCanChannel(ch1);

        // 发送64字节长帧测试高速传输
        const data64: number[] = [];
        for (let i = 0; i < 64; i++) {
            data64.push(i);
        }

        const testFrame: CanFDFrame = {
            id: 0x200,
            len: 64,
            data: data64,
            flags: 0,
            transmitType: 0,
        };

        console.log(`  发送64字节长帧: ID=0x${testFrame.id.toString(16)}`);
        const sendResult = device.transmitFD(ch0, testFrame);
        if (sendResult <= 0) {
            logTest('高速配置通信', false, `发送失败`);
            device.closeDevice();
            return false;
        }

        await sleep(50);

        const received = device.receiveFD(ch1, 10, 100);
        if (received.length === 0) {
            logTest('高速配置通信', false, '未接收到数据');
            device.closeDevice();
            return false;
        }

        const match = compareFrames(testFrame, received[0]);
        device.closeDevice();

        logTest('高速配置通信', match, match ? '64字节高速传输成功' : '数据不匹配');
        return match;

    } catch (error) {
        device.closeDevice();
        logTest('高速配置通信', false, `异常: ${error}`);
        return false;
    }
}

/**
 * @test 测试不同波特率组合
 * @description 遍历所有预设配置进行通信测试
 * @requires device 需要连接USBCANFD-200U设备
 */
export async function testAllPresetConfigs(): Promise<boolean> {
    console.log('\n--- 测试: 遍历所有预设配置 ---');

    const device = new ZlgCanDevice();
    const presetNames = Object.keys(ConfigPresets) as (keyof typeof ConfigPresets)[];
    let allPassed = true;

    for (const presetName of presetNames) {
        const config = ConfigPresets[presetName];
        console.log(`\n  测试预设: ${presetName}`);
        console.log(`    波特率: ${formatBaudRate(config.arbitrationBaudRate)}/${formatBaudRate(config.dataBaudRate)}`);

        try {
            const openResult = device.openDevice(TEST_CONFIG.deviceType, TEST_CONFIG.deviceIndex, 0);
            if (!openResult) {
                console.log(`    [FAIL] 设备打开失败`);
                allPassed = false;
                continue;
            }

            const ch0 = quickInitChannel(device, 0, config);
            const ch1 = quickInitChannel(device, 1, config);

            if (ch0 === 0 || ch1 === 0) {
                console.log(`    [FAIL] 通道初始化失败`);
                device.closeDevice();
                allPassed = false;
                continue;
            }

            device.startCanChannel(ch0);
            device.startCanChannel(ch1);

            const testFrame: CanFDFrame = {
                id: 0x300,
                len: 8,
                data: [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22],
                flags: 0,
                transmitType: 0,
            };

            device.transmitFD(ch0, testFrame);
            await sleep(50);

            const received = device.receiveFD(ch1, 10, 100);
            const match = received.length > 0 && compareFrames(testFrame, received[0]);

            device.closeDevice();

            if (match) {
                console.log(`    [PASS] 通信成功`);
            } else {
                console.log(`    [FAIL] 通信失败`);
                allPassed = false;
            }

        } catch (error) {
            console.log(`    [FAIL] 异常: ${error}`);
            device.closeDevice();
            allPassed = false;
        }
    }

    logTest('遍历所有预设配置', allPassed, allPassed ? '所有配置测试通过' : '部分配置测试失败');
    return allPassed;
}

// ============================================================================
// 测试摘要和运行
// ============================================================================

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
 * 运行所有单元测试（不需要设备）
 */
export async function runUnitTests() {
    console.log('============================================');
    console.log('    波特率配置模块单元测试');
    console.log('============================================');

    testDefaultConfig();
    testConfigPresets();
    testFormatBaudRate();
    testConfigSummary();
    testGetChannelConfig();

    printSummary();
}

/**
 * 运行所有设备测试（需要设备连接）
 */
export async function runDeviceTests() {
    console.log('============================================');
    console.log('    波特率配置模块设备测试');
    console.log('    设备: USBCANFD-200U');
    console.log('    连接: 通道0 <-> 通道1');
    console.log('============================================');

    await testDefaultConfigCommunication();
    await testHighSpeedConfigCommunication();
    await testAllPresetConfigs();

    printSummary();
}

/**
 * 运行所有测试
 */
export async function runAllTests() {
    console.log('============================================');
    console.log('    波特率配置模块完整测试');
    console.log('============================================');

    // 单元测试
    testDefaultConfig();
    testConfigPresets();
    testFormatBaudRate();
    testConfigSummary();
    testGetChannelConfig();

    // 设备测试
    await testDefaultConfigCommunication();
    await testHighSpeedConfigCommunication();
    // await testAllPresetConfigs(); // 耗时较长，可选

    printSummary();
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args.includes('--unit')) {
    runUnitTests().catch(console.error);
} else if (args.includes('--device')) {
    runDeviceTests().catch(console.error);
} else {
    runAllTests().catch(console.error);
}
