/**
 * 执行器相关类型定义
 * 包含测试执行、任务管理等相关类型
 */

/** 发送任务 */
export interface SendTask {
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

/** 执行状态 */
export type ExecutionState = "idle" | "running" | "paused" | "stopped";

/** 执行结果 */
export interface ExecutionResult {
  success: boolean;
  message: string;
  details?: string;
}

/** 命令执行结果 */
export interface CommandResult {
  command: string;
  success: boolean;
  message: string;
  line: number;
}

/** 测试用例结果 */
export interface TestCaseResult {
  name: string;
  success: boolean;
  commandResults: CommandResult[];
  duration: number;
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
