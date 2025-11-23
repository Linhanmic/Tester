/**
 * Tester脚本执行器
 * 负责执行解析后的Tester脚本
 */

import * as vscode from "vscode";
import {
  TesterParser,
  TesterProgram,
  ConfigurationBlock,
  TestSuite,
  TestCase,
  TestCommand,
  TcansCommand,
  TcanrCommand,
  TdelayCommand,
  ChannelConfig,
  BitRange,
} from "./parser";

// CAN设备相关类型（避免直接依赖可能不存在的native模块）
interface CanFrame {
  id: number;
  dlc: number;
  data: number[];
  transmitType?: number;
}

interface CanFDFrame {
  id: number;
  len: number;
  data: number[];
  flags?: number;
  transmitType?: number;
}

interface ReceivedFrame {
  id: number;
  dlc: number;
  data: number[];
  timestamp: number;
}

interface ReceivedFDFrame {
  id: number;
  len: number;
  data: number[];
  flags: number;
  timestamp: number;
}

interface CanChannelConfig {
  canType: number;
  accCode?: number;
  accMask?: number;
  reserved?: number;
  filter?: number;
  timing0?: number;
  timing1?: number;
  mode?: number;
  abitTiming?: number;
  dbitTiming?: number;
  brp?: number;
  pad?: number;
}

/** 执行结果 */
export interface ExecutionResult {
  success: boolean;
  message: string;
  details?: string;
}

/** 测试用例结果 */
export interface TestCaseResult {
  name: string;
  success: boolean;
  commandResults: CommandResult[];
  duration: number;
}

/** 命令执行结果 */
export interface CommandResult {
  command: string;
  success: boolean;
  message: string;
  line: number;
}

/** 测试用例集结果 */
export interface TestSuiteResult {
  name: string;
  testCaseResults: TestCaseResult[];
  passed: number;
  failed: number;
  duration: number;
}

/** 全部测试结果 */
export interface AllTestsResult {
  suiteResults: TestSuiteResult[];
  totalPassed: number;
  totalFailed: number;
  duration: number;
}

/**
 * Tester脚本执行器
 */
export class TesterExecutor {
  private outputChannel: vscode.OutputChannel;
  private parser: TesterParser;
  private device: any = null;
  private channelHandles: Map<number, number> = new Map(); // 项目通道索引 -> 设备通道句柄
  private channelConfigs: ChannelConfig[] = [];
  private isCanFD: Map<number, boolean> = new Map(); // 项目通道索引 -> 是否为CAN-FD

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Tester 执行器");
    this.parser = new TesterParser();
  }

  /**
   * 运行全部测试
   */
  public async runAllTests(documentUri: vscode.Uri): Promise<AllTestsResult> {
    const document = await vscode.workspace.openTextDocument(documentUri);
    const text = document.getText();

    this.outputChannel.clear();
    this.outputChannel.show(true);
    this.log("========================================");
    this.log("开始执行全部测试");
    this.log(`文件: ${documentUri.fsPath}`);
    this.log("========================================\n");

    const startTime = Date.now();
    const result: AllTestsResult = {
      suiteResults: [],
      totalPassed: 0,
      totalFailed: 0,
      duration: 0,
    };

    // 解析文档
    const parseResult = this.parser.parse(text);
    if (!parseResult.program) {
      this.logError("解析失败:");
      for (const error of parseResult.errors) {
        this.logError(`  第 ${error.line + 1} 行: ${error.message}`);
      }
      result.duration = Date.now() - startTime;
      return result;
    }

    const program = parseResult.program;

    // 初始化设备
    if (program.configuration) {
      const initResult = await this.initializeDevice(program.configuration);
      if (!initResult.success) {
        this.logError(`设备初始化失败: ${initResult.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }
    }

    try {
      // 执行所有测试用例集
      for (const suite of program.testSuites) {
        const suiteResult = await this.executeTestSuite(suite);
        result.suiteResults.push(suiteResult);
        result.totalPassed += suiteResult.passed;
        result.totalFailed += suiteResult.failed;
      }
    } finally {
      // 关闭设备
      await this.closeDevice();
    }

    result.duration = Date.now() - startTime;

    this.log("\n========================================");
    this.log("测试执行完成");
    this.log(`通过: ${result.totalPassed}, 失败: ${result.totalFailed}`);
    this.log(`总耗时: ${result.duration}ms`);
    this.log("========================================");

    // 显示汇总通知
    if (result.totalFailed === 0) {
      vscode.window.showInformationMessage(`所有测试通过! (${result.totalPassed}个用例)`);
    } else {
      vscode.window.showWarningMessage(`测试完成: ${result.totalPassed}通过, ${result.totalFailed}失败`);
    }

    return result;
  }

  /**
   * 运行指定测试用例集
   */
  public async runTestSuiteByLine(documentUri: vscode.Uri, lineNumber: number, suiteName: string): Promise<TestSuiteResult> {
    const document = await vscode.workspace.openTextDocument(documentUri);
    const text = document.getText();

    this.outputChannel.clear();
    this.outputChannel.show(true);
    this.log("========================================");
    this.log(`开始执行测试用例集: ${suiteName}`);
    this.log(`文件: ${documentUri.fsPath}`);
    this.log(`行号: ${lineNumber + 1}`);
    this.log("========================================\n");

    const startTime = Date.now();

    // 首先解析整个文档获取配置
    const fullParseResult = this.parser.parse(text);
    const configuration = fullParseResult.program?.configuration;

    // 解析指定行的测试用例集
    const suite = this.parser.parseTestSuiteAtLine(text, lineNumber);
    if (!suite) {
      this.logError(`无法解析测试用例集 "${suiteName}"`);
      return {
        name: suiteName,
        testCaseResults: [],
        passed: 0,
        failed: 0,
        duration: Date.now() - startTime,
      };
    }

    // 初始化设备
    if (configuration) {
      const initResult = await this.initializeDevice(configuration);
      if (!initResult.success) {
        this.logError(`设备初始化失败: ${initResult.message}`);
        return {
          name: suiteName,
          testCaseResults: [],
          passed: 0,
          failed: 0,
          duration: Date.now() - startTime,
        };
      }
    }

    let result: TestSuiteResult;
    try {
      result = await this.executeTestSuite(suite);
    } finally {
      await this.closeDevice();
    }

    this.log("\n========================================");
    this.log(`测试用例集 "${suiteName}" 执行完成`);
    this.log(`通过: ${result.passed}, 失败: ${result.failed}`);
    this.log(`耗时: ${result.duration}ms`);
    this.log("========================================");

    // 显示通知
    if (result.failed === 0) {
      vscode.window.showInformationMessage(`测试用例集 "${suiteName}" 全部通过! (${result.passed}个用例)`);
    } else {
      vscode.window.showWarningMessage(`"${suiteName}": ${result.passed}通过, ${result.failed}失败`);
    }

    return result;
  }

  /**
   * 运行指定测试用例
   */
  public async runTestCaseByLine(documentUri: vscode.Uri, lineNumber: number, caseName: string): Promise<TestCaseResult> {
    const document = await vscode.workspace.openTextDocument(documentUri);
    const text = document.getText();

    this.outputChannel.clear();
    this.outputChannel.show(true);
    this.log("========================================");
    this.log(`开始执行测试用例: ${caseName}`);
    this.log(`文件: ${documentUri.fsPath}`);
    this.log(`行号: ${lineNumber + 1}`);
    this.log("========================================\n");

    const startTime = Date.now();

    // 解析测试用例和配置
    const parseResult = this.parser.parseTestCaseAtLine(text, lineNumber);
    if (!parseResult) {
      this.logError(`无法解析测试用例 "${caseName}"`);
      return {
        name: caseName,
        success: false,
        commandResults: [],
        duration: Date.now() - startTime,
      };
    }

    const { testCase, configuration } = parseResult;

    // 初始化设备
    if (configuration) {
      const initResult = await this.initializeDevice(configuration);
      if (!initResult.success) {
        this.logError(`设备初始化失败: ${initResult.message}`);
        return {
          name: caseName,
          success: false,
          commandResults: [],
          duration: Date.now() - startTime,
        };
      }
    }

    let result: TestCaseResult;
    try {
      result = await this.executeTestCase(testCase);
    } finally {
      await this.closeDevice();
    }

    this.log("\n========================================");
    this.log(`测试用例 "${caseName}" 执行完成`);
    this.log(`结果: ${result.success ? "通过" : "失败"}`);
    this.log(`耗时: ${result.duration}ms`);
    this.log("========================================");

    // 显示通知
    if (result.success) {
      vscode.window.showInformationMessage(`测试用例 "${caseName}" 通过!`);
    } else {
      vscode.window.showErrorMessage(`测试用例 "${caseName}" 失败`);
    }

    return result;
  }

  /**
   * 初始化CAN设备
   */
  private async initializeDevice(config: ConfigurationBlock): Promise<ExecutionResult> {
    this.log("初始化CAN设备...");
    this.channelConfigs = config.channels;
    this.channelHandles.clear();
    this.isCanFD.clear();

    try {
      // 动态加载ZlgCanDevice
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const zlgcanModule = require("./zlgcan/index.js");
      const ZlgCanDevice = zlgcanModule.ZlgCanDevice;
      const DeviceType = zlgcanModule.DeviceType;
      const CanType = zlgcanModule.CanType;

      this.device = new ZlgCanDevice();

      // 按设备分组初始化
      const deviceGroups = new Map<string, ChannelConfig[]>();
      for (const channel of config.channels) {
        const key = `${channel.deviceId}-${channel.deviceIndex}`;
        if (!deviceGroups.has(key)) {
          deviceGroups.set(key, []);
        }
        deviceGroups.get(key)!.push(channel);
      }

      // 对每个设备进行初始化
      for (const [key, channels] of deviceGroups) {
        const firstChannel = channels[0];

        // 打开设备
        this.log(`  打开设备: type=${firstChannel.deviceId}, index=${firstChannel.deviceIndex}`);
        const opened = this.device.openDevice(firstChannel.deviceId, firstChannel.deviceIndex, 0);
        if (!opened) {
          return {
            success: false,
            message: `无法打开设备 ${firstChannel.deviceId}-${firstChannel.deviceIndex}`,
          };
        }

        // 初始化每个通道
        for (const channel of channels) {
          const isFD = channel.dataBaudrate !== undefined;
          this.isCanFD.set(channel.projectChannelIndex, isFD);

          const channelConfig: CanChannelConfig = {
            canType: isFD ? CanType.TYPE_CANFD : CanType.TYPE_CAN,
          };

          this.log(`  初始化通道: 项目通道${channel.projectChannelIndex} -> 设备通道${channel.channelIndex}`);
          this.log(`    波特率: ${channel.arbitrationBaudrate}kbps${isFD ? `, 数据域: ${channel.dataBaudrate}kbps` : ""}`);

          const handle = this.device.initCanChannel(channel.channelIndex, channelConfig);
          if (handle === 0) {
            return {
              success: false,
              message: `无法初始化通道 ${channel.channelIndex}`,
            };
          }

          // 启动通道
          const started = this.device.startCanChannel(handle);
          if (!started) {
            return {
              success: false,
              message: `无法启动通道 ${channel.channelIndex}`,
            };
          }

          this.channelHandles.set(channel.projectChannelIndex, handle);
        }
      }

      this.log("设备初始化完成\n");
      return { success: true, message: "设备初始化成功" };
    } catch (error: any) {
      // 如果无法加载设备驱动，使用模拟模式
      this.log("警告: 无法加载CAN设备驱动，将使用模拟模式");
      this.log(`  错误详情: ${error.message}`);
      this.device = null;

      // 为模拟模式设置通道映射
      for (const channel of config.channels) {
        this.channelHandles.set(channel.projectChannelIndex, channel.projectChannelIndex);
        this.isCanFD.set(channel.projectChannelIndex, channel.dataBaudrate !== undefined);
      }

      this.log("设备初始化完成（模拟模式）\n");
      return { success: true, message: "使用模拟模式" };
    }
  }

  /**
   * 关闭CAN设备
   */
  private async closeDevice(): Promise<void> {
    if (this.device) {
      try {
        this.device.closeDevice();
        this.log("设备已关闭");
      } catch (error: any) {
        this.logError(`关闭设备失败: ${error.message}`);
      }
      this.device = null;
    }
    this.channelHandles.clear();
  }

  /**
   * 执行测试用例集
   */
  private async executeTestSuite(suite: TestSuite): Promise<TestSuiteResult> {
    const startTime = Date.now();
    this.log(`\n>>> 测试用例集: ${suite.name}`);
    this.log("-".repeat(40));

    const result: TestSuiteResult = {
      name: suite.name,
      testCaseResults: [],
      passed: 0,
      failed: 0,
      duration: 0,
    };

    for (const testCase of suite.testCases) {
      const caseResult = await this.executeTestCase(testCase);
      result.testCaseResults.push(caseResult);
      if (caseResult.success) {
        result.passed++;
      } else {
        result.failed++;
      }
    }

    result.duration = Date.now() - startTime;
    this.log(`<<< 用例集完成: 通过=${result.passed}, 失败=${result.failed}, 耗时=${result.duration}ms\n`);
    return result;
  }

  /**
   * 执行测试用例
   */
  private async executeTestCase(testCase: TestCase): Promise<TestCaseResult> {
    const startTime = Date.now();
    const seqStr = testCase.sequenceNumber !== undefined ? `[${testCase.sequenceNumber}] ` : "";
    this.log(`\n  ${seqStr}${testCase.name}`);

    const result: TestCaseResult = {
      name: testCase.name,
      success: true,
      commandResults: [],
      duration: 0,
    };

    for (const command of testCase.commands) {
      const cmdResult = await this.executeCommand(command);
      result.commandResults.push(cmdResult);
      if (!cmdResult.success) {
        result.success = false;
      }
    }

    result.duration = Date.now() - startTime;
    this.log(`    结果: ${result.success ? "PASS" : "FAIL"} (${result.duration}ms)`);
    return result;
  }

  /**
   * 执行单个命令
   */
  private async executeCommand(command: TestCommand): Promise<CommandResult> {
    switch (command.type) {
      case "tcans":
        return await this.executeTcans(command);
      case "tcanr":
        return await this.executeTcanr(command);
      case "tdelay":
        return await this.executeTdelay(command);
      default:
        return {
          command: "unknown",
          success: false,
          message: "未知命令类型",
          line: 0,
        };
    }
  }

  /**
   * 执行 tcans 命令（发送报文）
   */
  private async executeTcans(command: TcansCommand): Promise<CommandResult> {
    const dataStr = command.data.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join("-");
    const cmdStr = `tcans ${command.channelIndex},0x${command.messageId.toString(16).toUpperCase()},${dataStr},${command.intervalMs},${command.repeatCount}`;

    this.log(`    > ${cmdStr}`);

    const channelHandle = this.channelHandles.get(command.channelIndex);
    if (channelHandle === undefined) {
      return {
        command: cmdStr,
        success: false,
        message: `项目通道 ${command.channelIndex} 未初始化`,
        line: command.line,
      };
    }

    try {
      const isFD = this.isCanFD.get(command.channelIndex) || false;

      for (let i = 0; i < command.repeatCount; i++) {
        if (this.device) {
          if (isFD) {
            const frame: CanFDFrame = {
              id: command.messageId,
              len: command.data.length,
              data: command.data,
            };
            this.device.transmitFD(channelHandle, frame);
          } else {
            const frame: CanFrame = {
              id: command.messageId,
              dlc: command.data.length,
              data: command.data,
            };
            this.device.transmit(channelHandle, frame);
          }
        } else {
          // 模拟模式：仅记录
          this.log(`      [模拟] 发送第 ${i + 1}/${command.repeatCount} 帧`);
        }

        // 发送间隔
        if (i < command.repeatCount - 1 && command.intervalMs > 0) {
          await this.delay(command.intervalMs);
        }
      }

      return {
        command: cmdStr,
        success: true,
        message: `成功发送 ${command.repeatCount} 帧`,
        line: command.line,
      };
    } catch (error: any) {
      return {
        command: cmdStr,
        success: false,
        message: `发送失败: ${error.message}`,
        line: command.line,
      };
    }
  }

  /**
   * 执行 tcanr 命令（接收并校验报文）
   */
  private async executeTcanr(command: TcanrCommand): Promise<CommandResult> {
    const rangeStr = command.bitRanges.map((r) => `${r.startByte}.${r.startBit}-${r.endByte}.${r.endBit}`).join("+");
    const expectedStr = command.expectedValues === "print" ? "print" : command.expectedValues.map((v) => `0x${v.toString(16).toUpperCase()}`).join("+");
    const cmdStr = `tcanr ${command.channelIndex},0x${command.messageId.toString(16).toUpperCase()},${rangeStr},${expectedStr},${command.timeoutMs}`;

    this.log(`    > ${cmdStr}`);

    const channelHandle = this.channelHandles.get(command.channelIndex);
    if (channelHandle === undefined) {
      return {
        command: cmdStr,
        success: false,
        message: `项目通道 ${command.channelIndex} 未初始化`,
        line: command.line,
      };
    }

    try {
      const isFD = this.isCanFD.get(command.channelIndex) || false;
      const startTime = Date.now();
      let receivedFrame: ReceivedFrame | ReceivedFDFrame | null = null;

      // 等待接收匹配的报文
      while (Date.now() - startTime < command.timeoutMs) {
        if (this.device) {
          const frames = isFD ? this.device.receiveFD(channelHandle, 100, 10) : this.device.receive(channelHandle, 100, 10);

          for (const frame of frames) {
            if (frame.id === command.messageId) {
              receivedFrame = frame;
              break;
            }
          }

          if (receivedFrame) {
            break;
          }
        } else {
          // 模拟模式：生成模拟数据
          await this.delay(50);
          receivedFrame = {
            id: command.messageId,
            dlc: 8,
            data: [0x50, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
            timestamp: Date.now(),
          };
          this.log(`      [模拟] 接收到报文 ID=0x${command.messageId.toString(16).toUpperCase()}`);
          break;
        }
      }

      if (!receivedFrame) {
        return {
          command: cmdStr,
          success: false,
          message: `接收超时 (${command.timeoutMs}ms)`,
          line: command.line,
        };
      }

      // 提取位范围数据
      const data = receivedFrame.data;
      const extractedValues = command.bitRanges.map((range) => this.extractBitRange(data, range));

      if (command.expectedValues === "print") {
        // 输出模式
        const valueStrs = extractedValues.map((v) => `0x${v.toString(16).toUpperCase()}`);
        this.log(`      接收值: ${valueStrs.join(", ")}`);
        return {
          command: cmdStr,
          success: true,
          message: `接收值: ${valueStrs.join(", ")}`,
          line: command.line,
        };
      } else {
        // 校验模式
        let allMatch = true;
        for (let i = 0; i < extractedValues.length && i < command.expectedValues.length; i++) {
          if (extractedValues[i] !== command.expectedValues[i]) {
            allMatch = false;
            this.log(`      期望: 0x${command.expectedValues[i].toString(16).toUpperCase()}, 实际: 0x${extractedValues[i].toString(16).toUpperCase()}`);
          }
        }

        if (allMatch) {
          return {
            command: cmdStr,
            success: true,
            message: "数据校验通过",
            line: command.line,
          };
        } else {
          return {
            command: cmdStr,
            success: false,
            message: "数据校验失败",
            line: command.line,
          };
        }
      }
    } catch (error: any) {
      return {
        command: cmdStr,
        success: false,
        message: `接收失败: ${error.message}`,
        line: command.line,
      };
    }
  }

  /**
   * 执行 tdelay 命令（延时）
   */
  private async executeTdelay(command: TdelayCommand): Promise<CommandResult> {
    const cmdStr = `tdelay ${command.delayMs}`;
    this.log(`    > ${cmdStr}`);

    await this.delay(command.delayMs);

    return {
      command: cmdStr,
      success: true,
      message: `延时 ${command.delayMs}ms`,
      line: command.line,
    };
  }

  /**
   * 从数据中提取位范围的值
   */
  private extractBitRange(data: number[], range: BitRange): number {
    let value = 0;
    let bitPos = 0;

    for (let byteIdx = range.startByte; byteIdx <= range.endByte; byteIdx++) {
      const byte = data[byteIdx] || 0;
      const startBit = byteIdx === range.startByte ? range.startBit : 0;
      const endBit = byteIdx === range.endByte ? range.endBit : 7;

      for (let bit = startBit; bit <= endBit; bit++) {
        if ((byte >> bit) & 1) {
          value |= 1 << bitPos;
        }
        bitPos++;
      }
    }

    return value;
  }

  /**
   * 延时函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    this.outputChannel.appendLine(message);
  }

  /**
   * 错误日志输出
   */
  private logError(message: string): void {
    this.outputChannel.appendLine(`[错误] ${message}`);
  }

  /**
   * 获取输出通道
   */
  public getOutputChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }
}
