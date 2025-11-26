/**
 * 解析器相关类型定义
 * 包含Tester语言的AST结构定义
 */

/** 通道初始化配置 */
export interface ChannelConfig {
  deviceId: number;
  deviceIndex: number;
  channelIndex: number;
  arbitrationBaudrate: number;
  dataBaudrate?: number; // CAN-FD模式
  projectChannelIndex: number; // 项目通道索引
}

/** 诊断配置 */
export interface DiagnoseConfig {
  requestId?: number; // tdiagnose_rid
  responseId?: number; // tdiagnose_sid
  securityKey?: number; // tdiagnose_keyk
  dtcList: DtcConfig[]; // 故障码列表
}

/** 故障码配置 */
export interface DtcConfig {
  code: string;
  description: string;
}

/** 配置块 */
export interface ConfigurationBlock {
  channels: ChannelConfig[];
  diagnose: DiagnoseConfig;
  startLine: number;
  endLine: number;
}

/** 发送命令 tcans */
export interface TcansCommand {
  type: "tcans";
  channelIndex: number;
  messageId: number;
  data: number[];
  intervalMs: number;
  repeatCount: number;
  line: number;
}

/** 接收校验命令 tcanr */
export interface TcanrCommand {
  type: "tcanr";
  channelIndex: number;
  messageId: number;
  bitRanges: BitRange[];
  expectedValues: number[] | "print";
  timeoutMs: number;
  line: number;
}

/** 延时命令 tdelay */
export interface TdelayCommand {
  type: "tdelay";
  delayMs: number;
  line: number;
}

/** 人机交互确认命令 tconfirm */
export interface TconfirmCommand {
  type: "tconfirm";
  message: string;
  line: number;
}

/** 位范围定义 */
export interface BitRange {
  startByte: number;
  startBit: number;
  endByte: number;
  endBit: number;
}

/** 测试命令联合类型 */
export type TestCommand = TcansCommand | TcanrCommand | TdelayCommand | TconfirmCommand;

/** 测试用例 */
export interface TestCase {
  sequenceNumber?: number;
  name: string;
  commands: TestCommand[];
  startLine: number;
  endLine: number;
}

/** 测试用例集 */
export interface TestSuite {
  name: string;
  testCases: TestCase[];
  startLine: number;
  endLine: number;
}

/** 解析后的程序结构 */
export interface TesterProgram {
  configuration?: ConfigurationBlock;
  testSuites: TestSuite[];
}

/** 解析错误 */
export interface ParseError {
  line: number;
  message: string;
}

/** 解析结果 */
export interface ParseResult {
  program?: TesterProgram;
  errors: ParseError[];
}
