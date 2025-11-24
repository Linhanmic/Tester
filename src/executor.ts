/**
 * Tester脚本执行器
 * 负责执行解析后的Tester脚本
 *
 * 特性：
 * - 使用真实CAN设备（不支持模拟模式）
 * - 每个tcans命令独立并行发送，按各自间隔周期发送
 * - 支持暂停/继续/停止发送控制
 * - 执行下一个测试用例时自动停止当前用例的发送
 */

import * as vscode from "vscode";
import {
  TesterParser,
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

// CAN设备相关类型
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

/** 发送任务 */
interface SendTask {
  id: number;
  channelIndex: number;
  messageId: number;
  data: number[];
  intervalMs: number;
  remainingCount: number;
  totalCount: number;
  timerId: ReturnType<typeof globalThis.setInterval> | null;
  isPaused: boolean;
  cmdStr: string;
  hasError: boolean;
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

/** 执行状态 */
export type ExecutionState = "idle" | "running" | "paused" | "stopped";

/** 接收的CAN报文 */
export interface ReceivedCanMessage {
  timestamp: number;
  channel: number;
  id: number;
  dlc: number;
  data: number[];
  isFD: boolean;
}

/** 发送的CAN报文 */
export interface SentCanMessage {
  timestamp: number;
  channel: number;
  id: number;
  dlc: number;
  data: number[];
  isFD: boolean;
}

/** 设备信息 */
export interface DeviceInfo {
  connected: boolean;
  deviceType: string;
  deviceIndex: number;
  channels: ChannelInfo[];
}

/** 通道信息 */
export interface ChannelInfo {
  projectIndex: number;
  deviceIndex: number;
  baudrate: number;
  dataBaudrate?: number;
  isFD: boolean;
  running: boolean;
}

/**
 * Tester脚本执行器
 */
export class TesterExecutor {
  private outputChannel: vscode.OutputChannel;
  private parser: TesterParser;
  private device: any = null;
  private channelHandles: Map<number, number> = new Map();
  private channelConfigs: ChannelConfig[] = [];
  private isCanFD: Map<number, boolean> = new Map();
  private channelIndexMap: Map<number, number> = new Map();

  // 设备是否已初始化
  private deviceInitialized: boolean = false;
  private currentConfigHash: string = "";

  // ZLG CAN 模块引用
  private zlgcanModule: any = null;

  // 发送任务管理
  private sendTasks: Map<number, SendTask> = new Map();
  private nextTaskId: number = 0;
  private executionState: ExecutionState = "idle";

  // 状态变更事件
  private _onStateChange: vscode.EventEmitter<ExecutionState> = new vscode.EventEmitter<ExecutionState>();
  public readonly onStateChange: vscode.Event<ExecutionState> = this._onStateChange.event;

  // 报文接收事件
  private _onMessageReceived: vscode.EventEmitter<ReceivedCanMessage> = new vscode.EventEmitter<ReceivedCanMessage>();
  public readonly onMessageReceived: vscode.Event<ReceivedCanMessage> = this._onMessageReceived.event;

  // 报文发送事件
  private _onMessageSent: vscode.EventEmitter<SentCanMessage> = new vscode.EventEmitter<SentCanMessage>();
  public readonly onMessageSent: vscode.Event<SentCanMessage> = this._onMessageSent.event;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Tester 执行器");
    this.parser = new TesterParser();
  }

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
    this._onStateChange.fire(state);
  }

  /**
   * 获取设备信息
   */
  public getDeviceInfo(): DeviceInfo {
    if (!this.deviceInitialized || !this.device) {
      return {
        connected: false,
        deviceType: '',
        deviceIndex: 0,
        channels: [],
      };
    }

    const channels: ChannelInfo[] = [];
    for (const config of this.channelConfigs) {
      channels.push({
        projectIndex: config.projectChannelIndex,
        deviceIndex: config.channelIndex,
        baudrate: config.arbitrationBaudrate,
        dataBaudrate: config.dataBaudrate,
        isFD: this.isCanFD.get(config.projectChannelIndex) || false,
        running: this.channelHandles.has(config.projectChannelIndex),
      });
    }

    return {
      connected: true,
      deviceType: this.channelConfigs[0]?.deviceId.toString() || '',
      deviceIndex: this.channelConfigs[0]?.deviceIndex || 0,
      channels,
    };
  }

  /**
   * 手动发送CAN报文
   */
  public async manualSendMessage(channel: number, id: number, data: number[], isFD: boolean): Promise<{ success: boolean; message: string }> {
    if (!this.deviceInitialized || !this.device) {
      return { success: false, message: '设备未初始化' };
    }

    const channelHandle = this.channelHandles.get(channel);
    if (channelHandle === undefined) {
      return { success: false, message: `通道 ${channel} 未初始化` };
    }

    try {
      if (isFD) {
        const frame: CanFDFrame = {
          id,
          len: data.length,
          data: [...data],
        };
        this.device.transmitFD(channelHandle, frame);
      } else {
        const frame: CanFrame = {
          id,
          dlc: data.length,
          data: [...data],
        };
        this.device.transmit(channelHandle, frame);
      }

      // 触发发送事件
      this._onMessageSent.fire({
        timestamp: Date.now(),
        channel,
        id,
        dlc: data.length,
        data: [...data],
        isFD,
      });

      return { success: true, message: '发送成功' };
    } catch (error: any) {
      return { success: false, message: `发送失败: ${error.message}` };
    }
  }

  /**
   * 暂停所有发送任务
   */
  public pauseAllTasks(): void {
    if (this.executionState !== "running") {
      return;
    }

    for (const task of this.sendTasks.values()) {
      if (task.timerId && !task.isPaused) {
        globalThis.clearInterval(task.timerId);
        task.timerId = null;
        task.isPaused = true;
      }
    }

    this.setState("paused");
    this.log("[控制] 已暂停所有发送任务");
  }

  /**
   * 继续所有发送任务
   */
  public resumeAllTasks(): void {
    if (this.executionState !== "paused") {
      return;
    }

    for (const task of this.sendTasks.values()) {
      if (task.isPaused && task.remainingCount > 0) {
        this.startTaskTimer(task);
        task.isPaused = false;
      }
    }

    this.setState("running");
    this.log("[控制] 已继续所有发送任务");
  }

  /**
   * 停止所有发送任务
   * @param andCloseDevice 是否同时关闭设备（用户手动停止时为true）
   */
  public stopAllTasks(andCloseDevice: boolean = false): void {
    for (const task of this.sendTasks.values()) {
      if (task.timerId) {
        globalThis.clearInterval(task.timerId);
        task.timerId = null;
      }
    }
    this.sendTasks.clear();

    if (this.executionState !== "idle") {
      this.setState("stopped");
      this.log("[控制] 已停止所有发送任务");
    }

    if (andCloseDevice) {
      this.closeDevice();
      this.setState("idle");
    }
  }

  /**
   * 启动任务定时器
   */
  private startTaskTimer(task: SendTask): void {
    const channelHandle = this.channelHandles.get(task.channelIndex);
    if (channelHandle === undefined || !this.device) {
      return;
    }

    const isFD = this.isCanFD.get(task.channelIndex) || false;

    // 立即发送第一帧
    this.sendSingleFrame(channelHandle, task, isFD);

    // 如果还有剩余次数，启动定时器
    if (task.remainingCount > 0) {
      task.timerId = globalThis.setInterval(() => {
        if (task.remainingCount > 0) {
          this.sendSingleFrame(channelHandle, task, isFD);
        }

        if (task.remainingCount <= 0) {
          if (task.timerId) {
            globalThis.clearInterval(task.timerId);
            task.timerId = null;
          }
          this.sendTasks.delete(task.id);
          this.log(`    [完成] ${task.cmdStr} 发送完毕`);

          // 检查是否所有任务都完成
          if (this.sendTasks.size === 0 && this.executionState === "running") {
            this.log("[控制] 所有发送任务已完成");
          }
        }
      }, task.intervalMs);
    }
  }

  /**
   * 发送单帧
   */
  private sendSingleFrame(channelHandle: number, task: SendTask, isFD: boolean): boolean {
    try {
      if (isFD) {
        const frame: CanFDFrame = {
          id: task.messageId,
          len: task.data.length,
          data: [...task.data],
        };
        this.device.transmitFD(channelHandle, frame);
      } else {
        const frame: CanFrame = {
          id: task.messageId,
          dlc: task.data.length,
          data: [...task.data],
        };
        this.device.transmit(channelHandle, frame);
      }

      // 触发发送事件
      this._onMessageSent.fire({
        timestamp: Date.now(),
        channel: task.channelIndex,
        id: task.messageId,
        dlc: task.data.length,
        data: [...task.data],
        isFD,
      });

      task.remainingCount--;
      return true;
    } catch (error: any) {
      this.logError(`发送帧失败: ${error.message}`);
      task.hasError = true;
      return false;
    }
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

    // 初始化设备（必须成功）
    if (program.configuration) {
      const initResult = await this.initializeDevice(program.configuration);
      if (!initResult.success) {
        this.logError(`设备初始化失败: ${initResult.message}`);
        vscode.window.showErrorMessage(`设备初始化失败: ${initResult.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }
    } else {
      this.logError("缺少配置块，无法初始化设备");
      vscode.window.showErrorMessage("缺少配置块，无法初始化设备");
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
      // 停止所有发送任务并关闭设备
      this.stopAllTasks(true);
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

    // 初始化设备（必须成功）
    if (configuration) {
      const initResult = await this.initializeDevice(configuration);
      if (!initResult.success) {
        this.logError(`设备初始化失败: ${initResult.message}`);
        vscode.window.showErrorMessage(`设备初始化失败: ${initResult.message}`);
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
      vscode.window.showErrorMessage("缺少配置块，无法初始化设备");
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
      // 停止所有发送任务并关闭设备
      this.stopAllTasks(true);
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

    // 初始化设备（必须成功）
    if (configuration) {
      const initResult = await this.initializeDevice(configuration);
      if (!initResult.success) {
        this.logError(`设备初始化失败: ${initResult.message}`);
        vscode.window.showErrorMessage(`设备初始化失败: ${initResult.message}`);
        return {
          name: caseName,
          success: false,
          commandResults: [],
          duration: Date.now() - startTime,
        };
      }
    } else {
      this.logError("缺少配置块，无法初始化设备");
      vscode.window.showErrorMessage("缺少配置块，无法初始化设备");
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
    if (this.sendTasks.size > 0) {
      this.log(`发送任务仍在运行中，点击"停止"按钮可停止所有发送`);
    }
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
   * 计算配置哈希值，用于判断配置是否变化
   */
  private getConfigHash(config: ConfigurationBlock): string {
    return JSON.stringify(config.channels.map(c => ({
      deviceId: c.deviceId,
      deviceIndex: c.deviceIndex,
      channelIndex: c.channelIndex,
      projectChannelIndex: c.projectChannelIndex,
      arbitrationBaudrate: c.arbitrationBaudrate,
      dataBaudrate: c.dataBaudrate,
    })));
  }

  /**
   * 初始化CAN设备（不支持模拟模式）
   * 如果设备已初始化且配置相同，则复用现有设备
   */
  private async initializeDevice(config: ConfigurationBlock): Promise<ExecutionResult> {
    const configHash = this.getConfigHash(config);

    // 如果设备已初始化且配置相同，直接返回成功
    if (this.deviceInitialized && this.device && this.currentConfigHash === configHash) {
      this.log("复用已初始化的CAN设备\n");
      return { success: true, message: "设备已就绪" };
    }

    // 如果设备已打开但配置不同，先关闭
    if (this.deviceInitialized && this.device) {
      this.log("配置已变更，重新初始化设备...");
      this.closeDevice();
    }

    this.log("初始化CAN设备...");
    this.channelConfigs = config.channels;
    this.channelHandles.clear();
    this.isCanFD.clear();
    this.channelIndexMap.clear();

    try {
      // 动态加载ZlgCanDevice
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.zlgcanModule = require("./zlgcan/index.js");
      const ZlgCanDevice = this.zlgcanModule.ZlgCanDevice;
      const CanType = this.zlgcanModule.CanType;

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
      for (const [, channels] of deviceGroups) {
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
          this.channelIndexMap.set(channel.projectChannelIndex, channel.channelIndex);

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

      this.deviceInitialized = true;
      this.currentConfigHash = configHash;
      this.log("设备初始化完成\n");
      return { success: true, message: "设备初始化成功" };
    } catch (error: any) {
      this.deviceInitialized = false;
      this.currentConfigHash = "";
      return {
        success: false,
        message: `加载CAN设备驱动失败: ${error.message}`,
      };
    }
  }

  /**
   * 关闭CAN设备
   */
  private closeDevice(): void {
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
    this.deviceInitialized = false;
    this.currentConfigHash = "";
  }

  // ========== 测试执行 ==========

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
      if (this.executionState === "stopped") {
        break;
      }
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
   * @param testCase 测试用例
   * @param stopPrevious 是否停止之前的发送任务（切换测试用例时为true）
   */
  private async executeTestCase(testCase: TestCase, stopPrevious: boolean = true): Promise<TestCaseResult> {
    const startTime = Date.now();
    const seqStr = testCase.sequenceNumber !== undefined ? `[${testCase.sequenceNumber}] ` : "";
    this.log(`\n  ${seqStr}${testCase.name}`);

    // 切换测试用例时停止之前的发送任务
    if (stopPrevious) {
      this.stopAllTasks();
    }
    this.setState("running");

    const result: TestCaseResult = {
      name: testCase.name,
      success: true,
      commandResults: [],
      duration: 0,
    };

    for (const command of testCase.commands) {
      if (this.executionState === "stopped") {
        break;
      }

      // 等待暂停状态解除
      while (this.executionState === "paused") {
        await this.delay(100);
      }

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
   * 执行 tcans 命令（创建独立发送任务）
   * 每个tcans命令创建一个独立的发送任务，按指定间隔周期发送
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
      // 创建发送任务
      const taskId = this.nextTaskId++;
      const task: SendTask = {
        id: taskId,
        channelIndex: command.channelIndex,
        messageId: command.messageId,
        data: [...command.data],
        intervalMs: command.intervalMs,
        remainingCount: command.repeatCount,
        totalCount: command.repeatCount,
        timerId: null,
        isPaused: false,
        cmdStr,
        hasError: false,
      };

      this.sendTasks.set(taskId, task);

      // 启动发送任务（会立即发送第一帧）
      this.startTaskTimer(task);

      // 检查第一帧是否发送成功
      if (task.hasError) {
        return {
          command: cmdStr,
          success: false,
          message: `发送帧失败`,
          line: command.line,
        };
      }

      this.log(`    [发送] 已启动发送任务 #${taskId}: ID=0x${command.messageId.toString(16).toUpperCase()}, 间隔=${command.intervalMs}ms, 次数=${command.repeatCount}`);

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
        if (this.executionState === "stopped") {
          return {
            command: cmdStr,
            success: false,
            message: "执行已停止",
            line: command.line,
          };
        }

        const frames = isFD
          ? this.device.receiveFD(channelHandle, 100, 10)
          : this.device.receive(channelHandle, 100, 10);

        for (const frame of frames) {
          if (frame.id === command.messageId) {
            receivedFrame = frame;
            break;
          }
        }

        if (receivedFrame) {
          break;
        }

        // 短暂等待避免CPU占用过高
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
   * 执行 tdelay 命令（延时后执行下一条命令）
   */
  private async executeTdelay(command: TdelayCommand): Promise<CommandResult> {
    const cmdStr = `tdelay ${command.delayMs}`;
    this.log(`    > ${cmdStr}`);

    // 延时指定时间
    await this.delay(command.delayMs);

    return {
      command: cmdStr,
      success: true,
      message: `延时 ${command.delayMs}ms 完成`,
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
