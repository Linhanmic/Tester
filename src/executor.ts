/**
 * Tester脚本执行器 (重构版)
 * 负责协调各个模块执行测试脚本
 *
 * 重构说明:
 * - 使用DeviceManager管理设备
 * - 使用TaskManager管理发送任务
 * - 使用MessagePoller管理报文轮询
 * - 本类专注于测试执行逻辑
 *
 * 从1406行精简到约700行
 */

import * as vscode from "vscode";
import { TesterParser } from "./parser";
import {
  ConfigurationBlock,
  TestSuite,
  TestCase,
  TestCommand,
  TcansCommand,
  TcanrCommand,
  TdelayCommand,
  TconfirmCommand,
  BitRange,
} from "./types/parser.types";
import {
  ExecutionResult,
  ExecutionState,
  CommandResult,
  TestCaseResult,
  TestSuiteResult,
  AllTestsResult,
} from "./types/executor.types";
import {
  ReceivedCanMessage,
  SentCanMessage,
  DeviceInfo,
  ReceivedFrame,
  ReceivedFDFrame,
} from "./types/device.types";
import { DeviceManager } from "./core/device";
import { TaskManager } from "./core/tasks";
import { MessagePoller } from "./core/poller";
import { Logger, LogLevel, createLogger } from "./utils/logger";
import { showError, showInfo, showWarning } from "./utils/notification";
import { formatDataBytes, formatHex } from "./utils/hexParser";

// Re-export types for external use
export type { ExecutionState } from "./types/executor.types";

/**
 * Tester脚本执行器
 */
export class TesterExecutor {
  private outputChannel: vscode.OutputChannel;
  private parser: TesterParser;
  private logger: Logger;

  // 核心模块
  private deviceManager: DeviceManager;
  private taskManager: TaskManager;
  private messagePoller: MessagePoller;

  // 执行状态
  private executionState: ExecutionState = "idle";

  // 事件发射器
  private _onStateChange = new vscode.EventEmitter<ExecutionState>();
  public readonly onStateChange = this._onStateChange.event;

  private _onMessageReceived = new vscode.EventEmitter<ReceivedCanMessage>();
  public readonly onMessageReceived = this._onMessageReceived.event;

  private _onMessageSent = new vscode.EventEmitter<SentCanMessage>();
  public readonly onMessageSent = this._onMessageSent.event;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Tester 执行器");
    this.parser = new TesterParser();
    this.logger = createLogger("Tester Executor", LogLevel.INFO);

    // 初始化核心模块
    this.deviceManager = new DeviceManager(this.logger);
    this.taskManager = new TaskManager(this.logger, this._onMessageSent);
    this.messagePoller = new MessagePoller(this.logger, this._onMessageReceived);
  }

  // ========== 状态管理 ==========

  /**
   * 获取当前执行状态
   */
  public getState(): ExecutionState {
    return this.executionState;
  }

  /**
   * 设置执行状态
   */
  private setState(state: ExecutionState): void {
    this.executionState = state;
    this.taskManager.setState(state);
    this._onStateChange.fire(state);
  }

  /**
   * 获取设备信息
   */
  public getDeviceInfo(): DeviceInfo {
    if (!this.deviceManager.isInitialized()) {
      return {
        connected: false,
        deviceType: '',
        deviceIndex: 0,
        channels: [],
      };
    }

    const configs = this.deviceManager.getChannelConfigs();
    const channels = configs.map(config => ({
      projectIndex: config.projectChannelIndex,
      deviceIndex: config.channelIndex,
      baudrate: config.arbitrationBaudrate,
      dataBaudrate: config.dataBaudrate,
      isFD: this.deviceManager.isChannelFD(config.projectChannelIndex),
      running: this.deviceManager.getChannelHandle(config.projectChannelIndex) !== undefined,
    }));

    return {
      connected: true,
      deviceType: configs[0]?.deviceId.toString() || '',
      deviceIndex: configs[0]?.deviceIndex || 0,
      channels,
    };
  }

  /**
   * 获取输出通道
   */
  public getOutputChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }

  // ========== 设备操作 ==========

  /**
   * 从配置打开设备
   */
  public async openDeviceFromConfig(
    deviceType: number,
    deviceIndex: number,
    channels: Array<{
      channelIndex: number;
      projectChannelIndex: number;
      arbitrationBaudrate: number;
      dataBaudrate?: number;
    }>
  ): Promise<ExecutionResult> {
    // 转换为ChannelConfig格式
    const channelConfigs = channels.map(ch => ({
      deviceId: deviceType,
      deviceIndex: deviceIndex,
      channelIndex: ch.channelIndex,
      arbitrationBaudrate: ch.arbitrationBaudrate,
      dataBaudrate: ch.dataBaudrate,
      projectChannelIndex: ch.projectChannelIndex,
    }));

    const result = await this.deviceManager.openDevice(channelConfigs);

    if (result.success) {
      // 启动报文轮询
      this.messagePoller.startPolling(
        this.deviceManager.getDevice(),
        this.deviceManager.getAllChannelHandles(),
        new Map(channelConfigs.map(c => [c.projectChannelIndex, c.dataBaudrate !== undefined]))
      );
    }

    return result;
  }

  /**
   * 为手动发送打开设备
   */
  public async openDeviceForManualSend(documentUri: vscode.Uri): Promise<ExecutionResult> {
    const document = await vscode.workspace.openTextDocument(documentUri);
    const text = document.getText();

    // 解析配置
    const parseResult = this.parser.parse(text);
    if (!parseResult.program?.configuration) {
      return {
        success: false,
        message: '文档中没有找到配置块(tset...tend)'
      };
    }

    return await this.initializeDevice(parseResult.program.configuration);
  }

  /**
   * 手动关闭设备
   */
  public closeDeviceManually(): void {
    this.messagePoller.stopPolling();
    this.taskManager.stopAllTasks();
    this.deviceManager.closeDevice();
    this.setState('idle');
  }

  /**
   * 手动发送CAN报文
   */
  public async manualSendMessage(
    channel: number,
    id: number,
    data: number[],
    isFD: boolean
  ): Promise<ExecutionResult> {
    if (!this.deviceManager.isInitialized()) {
      return { success: false, message: '设备未初始化' };
    }

    const channelHandle = this.deviceManager.getChannelHandle(channel);
    if (channelHandle === undefined) {
      return { success: false, message: `通道 ${channel} 未初始化` };
    }

    const device = this.deviceManager.getDevice();

    // 创建一个临时任务来发送单帧
    this.taskManager.createSendTask(
      channel,
      id,
      data,
      0,
      1,
      device,
      channelHandle,
      isFD
    );

    return {
      success: true,
      message: `报文已发送: ID=0x${formatHex(id, 3, false)}, 数据=${formatDataBytes(data)}`
    };
  }

  // ========== 任务控制 ==========

  /**
   * 暂停所有发送任务
   */
  public pauseAllTasks(): void {
    this.taskManager.pauseAllTasks();
  }

  /**
   * 继续所有发送任务
   */
  public resumeAllTasks(): void {
    this.taskManager.resumeAllTasks();
  }

  /**
   * 停止所有任务
   */
  public stopAllTasks(andCloseDevice: boolean = false): void {
    this.taskManager.stopAllTasks();
    this.setState('stopped');

    if (andCloseDevice) {
      this.messagePoller.stopPolling();
      this.deviceManager.closeDevice();
    }
  }

  // ========== 测试执行 ==========

  /**
   * 运行所有测试
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
        showError(`设备初始化失败: ${initResult.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }
    } else {
      this.logError("缺少配置块，无法初始化设备");
      showError("缺少配置块，无法初始化设备");
      result.duration = Date.now() - startTime;
      return result;
    }

    this.setState("running");

    try {
      // 执行所有测试用例集
      for (const suite of program.testSuites) {
        if (this.executionState === "stopped") {
          break;
        }
        const suiteResult = await this.executeTestSuite(suite);
        result.suiteResults.push(suiteResult);
        result.totalPassed += suiteResult.passed;
        result.totalFailed += suiteResult.failed;
      }
    } finally {
      this.stopAllTasks(true);
    }

    result.duration = Date.now() - startTime;

    this.log("\n========================================");
    this.log("测试执行完成");
    this.log(`通过: ${result.totalPassed}, 失败: ${result.totalFailed}`);
    this.log(`总耗时: ${result.duration}ms`);
    this.log("========================================");

    if (result.totalFailed === 0) {
      showInfo(`所有测试通过! (${result.totalPassed}个用例)`);
    } else {
      showWarning(`测试完成: ${result.totalPassed}通过, ${result.totalFailed}失败`);
    }

    return result;
  }

  /**
   * 运行指定测试用例集
   */
  public async runTestSuiteByLine(
    documentUri: vscode.Uri,
    lineNumber: number,
    suiteName: string
  ): Promise<TestSuiteResult> {
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

    // 解析配置和测试用例集
    const fullParseResult = this.parser.parse(text);
    const configuration = fullParseResult.program?.configuration;

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
        showError(`设备初始化失败: ${initResult.message}`);
        return {
          name: suiteName,
          testCaseResults: [],
          passed: 0,
          failed: 0,
          duration: Date.now() - startTime,
        };
      }
    } else {
      this.logError("缺少配置块，无法初始化设备");
      showError("缺少配置块，无法初始化设备");
      return {
        name: suiteName,
        testCaseResults: [],
        passed: 0,
        failed: 0,
        duration: Date.now() - startTime,
      };
    }

    this.setState("running");

    let result: TestSuiteResult;
    try {
      result = await this.executeTestSuite(suite);
    } finally {
      this.stopAllTasks(true);
    }

    this.log("\n========================================");
    this.log(`测试用例集 "${suiteName}" 执行完成`);
    this.log(`通过: ${result.passed}, 失败: ${result.failed}`);
    this.log(`耗时: ${result.duration}ms`);
    this.log("========================================");

    if (result.failed === 0) {
      showInfo(`测试用例集 "${suiteName}" 全部通过! (${result.passed}个用例)`);
    } else {
      showWarning(`"${suiteName}": ${result.passed}通过, ${result.failed}失败`);
    }

    return result;
  }

  /**
   * 运行指定测试用例
   */
  public async runTestCaseByLine(
    documentUri: vscode.Uri,
    lineNumber: number,
    caseName: string
  ): Promise<TestCaseResult> {
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
        showError(`设备初始化失败: ${initResult.message}`);
        return {
          name: caseName,
          success: false,
          commandResults: [],
          duration: Date.now() - startTime,
        };
      }
    } else {
      this.logError("缺少配置块，无法初始化设备");
      showError("缺少配置块，无法初始化设备");
      return {
        name: caseName,
        success: false,
        commandResults: [],
        duration: Date.now() - startTime,
      };
    }

    this.setState("running");

    const result = await this.executeTestCase(testCase, false);

    this.log("\n========================================");
    this.log(`测试用例 "${caseName}" 执行完成`);
    this.log(`结果: ${result.success ? "通过" : "失败"}`);
    this.log(`耗时: ${result.duration}ms`);
    if (this.taskManager.hasActiveTasks()) {
      this.log(`发送任务仍在运行中，点击"停止"按钮可停止所有发送`);
    }
    this.log("========================================");

    if (result.success) {
      showInfo(`测试用例 "${caseName}" 通过!`);
    } else {
      showError(`测试用例 "${caseName}" 失败`);
    }

    return result;
  }

  // ========== 私有方法 ==========

  /**
   * 初始化设备
   */
  private async initializeDevice(config: ConfigurationBlock): Promise<ExecutionResult> {
    this.log("初始化CAN设备...");

    const result = await this.deviceManager.openDevice(config.channels);

    if (result.success) {
      // 启动报文轮询
      const isCanFDMap = new Map<number, boolean>();
      for (const ch of config.channels) {
        isCanFDMap.set(ch.projectChannelIndex, ch.dataBaudrate !== undefined);
      }

      this.messagePoller.startPolling(
        this.deviceManager.getDevice(),
        this.deviceManager.getAllChannelHandles(),
        isCanFDMap
      );

      this.log("设备初始化成功\n");
    }

    return result;
  }

  /**
   * 执行测试用例集
   */
  private async executeTestSuite(suite: TestSuite): Promise<TestSuiteResult> {
    const startTime = Date.now();
    this.log(`\n执行测试用例集: ${suite.name}`);
    this.log("----------------------------------------");

    const testCaseResults: TestCaseResult[] = [];

    for (const testCase of suite.testCases) {
      if (this.executionState === "stopped") {
        break;
      }

      // 每个测试用例开始前停止之前的发送任务
      this.taskManager.stopAllTasks();

      const result = await this.executeTestCase(testCase, true);
      testCaseResults.push(result);
    }

    const passed = testCaseResults.filter(r => r.success).length;
    const failed = testCaseResults.length - passed;

    return {
      name: suite.name,
      testCaseResults,
      passed,
      failed,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 执行单个测试用例
   */
  private async executeTestCase(
    testCase: TestCase,
    isInSuite: boolean
  ): Promise<TestCaseResult> {
    const startTime = Date.now();
    const seqStr = testCase.sequenceNumber !== undefined ? `${testCase.sequenceNumber}. ` : '';
    this.log(`\n  ${seqStr}${testCase.name}`);

    const commandResults: CommandResult[] = [];

    for (const command of testCase.commands) {
      if (this.executionState === "stopped") {
        break;
      }

      const cmdResult = await this.executeCommand(command);
      commandResults.push(cmdResult);

      if (!cmdResult.success && !isInSuite) {
        // 单独执行测试用例时，失败后继续执行
        this.logError(`  ✗ ${cmdResult.message}`);
      }
    }

    const success = commandResults.every(r => r.success);
    const statusIcon = success ? "✓" : "✗";
    this.log(`  ${statusIcon} ${testCase.name}: ${success ? "通过" : "失败"}`);

    return {
      name: testCase.name,
      success,
      commandResults,
      duration: Date.now() - startTime,
    };
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
      case "tconfirm":
        return await this.executeTconfirm(command);
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
   * 执行tcans命令（发送）
   */
  private async executeTcans(command: TcansCommand): Promise<CommandResult> {
    const cmdStr = `tcans ${command.channelIndex},0x${formatHex(command.messageId, 3, false)},${formatDataBytes(command.data)},${command.intervalMs},${command.repeatCount}`;
    this.log(`    > ${cmdStr}`);

    const channelHandle = this.deviceManager.getChannelHandle(command.channelIndex);
    if (channelHandle === undefined) {
      return {
        command: cmdStr,
        success: false,
        message: `项目通道 ${command.channelIndex} 未初始化`,
        line: command.line,
      };
    }

    try {
      const isFD = this.deviceManager.isChannelFD(command.channelIndex);
      const device = this.deviceManager.getDevice();

      // 创建发送任务
      const taskId = this.taskManager.createSendTask(
        command.channelIndex,
        command.messageId,
        command.data,
        command.intervalMs,
        command.repeatCount,
        device,
        channelHandle,
        isFD
      );

      this.log(`    [发送] 已启动发送任务 #${taskId}: ID=0x${formatHex(command.messageId, 3, false)}, 间隔=${command.intervalMs}ms, 次数=${command.repeatCount}`);

      return {
        command: cmdStr,
        success: true,
        message: `发送任务已启动`,
        line: command.line,
      };
    } catch (error: any) {
      return {
        command: cmdStr,
        success: false,
        message: `创建发送任务失败: ${error.message}`,
        line: command.line,
      };
    }
  }

  /**
   * 执行tcanr命令（接收并校验）
   */
  private async executeTcanr(command: TcanrCommand): Promise<CommandResult> {
    const rangeStr = command.bitRanges.map(r => `${r.startByte}.${r.startBit}-${r.endByte}.${r.endBit}`).join("+");
    const expectedStr = command.expectedValues === "print"
      ? "print"
      : command.expectedValues.map(v => `0x${formatHex(v, 2, false)}`).join("+");
    const cmdStr = `tcanr ${command.channelIndex},0x${formatHex(command.messageId, 3, false)},${rangeStr},${expectedStr},${command.timeoutMs}`;

    this.log(`    > ${cmdStr}`);

    const channelHandle = this.deviceManager.getChannelHandle(command.channelIndex);
    if (channelHandle === undefined) {
      return {
        command: cmdStr,
        success: false,
        message: `项目通道 ${command.channelIndex} 未初始化`,
        line: command.line,
      };
    }

    try {
      const isFD = this.deviceManager.isChannelFD(command.channelIndex);
      const device = this.deviceManager.getDevice();
      const startTime = Date.now();
      let receivedFrame: ReceivedFrame | ReceivedFDFrame | null = null;

      // 等待接收匹配的报文
      while (Date.now() - startTime < command.timeoutMs) {
        if (this.executionState === "stopped") {
          return {
            command: cmdStr,
            success: false,
            message: "执行已停止",
            line: command.line,
          };
        }

        const frames = isFD
          ? device.receiveFD(channelHandle, 100, 10)
          : device.receive(channelHandle, 100, 10);

        for (const frame of frames) {
          if (frame.id === command.messageId) {
            receivedFrame = frame;
            break;
          }
        }

        if (receivedFrame) {
          break;
        }

        await this.delay(1);
      }

      if (!receivedFrame) {
        return {
          command: cmdStr,
          success: false,
          message: `接收超时 (${command.timeoutMs}ms)`,
          line: command.line,
        };
      }

      // 提取并校验数据
      const data = receivedFrame.data;
      const extractedValues = command.bitRanges.map(range => this.extractBitRange(data, range));

      if (command.expectedValues === "print") {
        const valueStrs = extractedValues.map(v => `0x${formatHex(v, 2, false)}`);
        this.log(`      接收值: ${valueStrs.join(", ")}`);
        return {
          command: cmdStr,
          success: true,
          message: `接收值: ${valueStrs.join(", ")}`,
          line: command.line,
        };
      } else {
        let allMatch = true;
        for (let i = 0; i < extractedValues.length && i < command.expectedValues.length; i++) {
          if (extractedValues[i] !== command.expectedValues[i]) {
            allMatch = false;
            this.log(`      期望: 0x${formatHex(command.expectedValues[i], 2, false)}, 实际: 0x${formatHex(extractedValues[i], 2, false)}`);
          }
        }

        return {
          command: cmdStr,
          success: allMatch,
          message: allMatch ? "数据校验通过" : "数据校验失败",
          line: command.line,
        };
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
   * 执行tdelay命令（延时）
   */
  private async executeTdelay(command: TdelayCommand): Promise<CommandResult> {
    const cmdStr = `tdelay ${command.delayMs}`;
    this.log(`    > ${cmdStr}`);

    await this.delay(command.delayMs);

    return {
      command: cmdStr,
      success: true,
      message: `延时 ${command.delayMs}ms 完成`,
      line: command.line,
    };
  }

  /**
   * 执行tconfirm命令（人机确认）
   */
  private async executeTconfirm(command: TconfirmCommand): Promise<CommandResult> {
    const cmdStr = `tconfirm ${command.message}`;
    this.log(`    > ${cmdStr}`);
    this.log(`      等待用户确认...`);

    const result = await vscode.window.showInformationMessage(
      command.message,
      { modal: true },
      "通过",
      "失败"
    );

    if (result === "通过") {
      this.log(`      用户确认: 通过`);
      return {
        command: cmdStr,
        success: true,
        message: "用户确认测试通过",
        line: command.line,
      };
    } else if (result === "失败") {
      this.log(`      用户确认: 失败`);
      return {
        command: cmdStr,
        success: false,
        message: "用户确认测试失败",
        line: command.line,
      };
    } else {
      this.log(`      用户取消了确认`);
      return {
        command: cmdStr,
        success: false,
        message: "用户取消了确认",
        line: command.line,
      };
    }
  }

  // ========== 辅助方法 ==========

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
    return new Promise(resolve => setTimeout(resolve, ms));
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
}
