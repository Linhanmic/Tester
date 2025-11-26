/**
 * 全局常量定义
 */

/** 接收轮询配置 */
export const RECEIVE_POLLING = {
  /** 轮询间隔(毫秒) */
  INTERVAL_MS: 10,
  /** 每次接收的最大帧数 */
  MAX_FRAMES: 100,
} as const;

/** 报文限制 */
export const MESSAGE_LIMITS = {
  /** 报文监视器最大显示数量 */
  MAX_MONITOR_MESSAGES: 1000,
  /** 手动发送历史记录最大数量 */
  MAX_SEND_HISTORY: 10,
} as const;

/** 批量更新配置 */
export const BATCH_UPDATE = {
  /** 报文监视器批量更新间隔(毫秒) */
  MESSAGE_MONITOR_DEBOUNCE_MS: 20,
} as const;

/** 默认超时配置 */
export const TIMEOUTS = {
  /** 设备初始化延迟(毫秒) */
  DEVICE_INIT_DELAY_MS: 1000,
  /** 默认接收超时(毫秒) */
  DEFAULT_RECEIVE_TIMEOUT_MS: 5000,
} as const;

/** CAN帧配置 */
export const CAN_FRAME = {
  /** 标准CAN最大数据长度 */
  MAX_DLC: 8,
  /** CAN-FD最大数据长度 */
  MAX_FD_LEN: 64,
} as const;

/** 文件扩展名 */
export const FILE_EXTENSIONS = {
  /** Tester脚本文件扩展名 */
  TESTER: '.tester',
  /** 设备配置文件扩展名 */
  DEVICE_CONFIG: '.json',
} as const;

/** 命令名称 */
export const COMMANDS = {
  RUN_ALL_TESTS: 'tester.runAllTests',
  RUN_TEST_SUITE: 'tester.runTestSuite',
  RUN_TEST_CASE: 'tester.runTestCase',
  PAUSE_EXECUTION: 'tester.pauseExecution',
  CONTINUE_EXECUTION: 'tester.continueExecution',
  STOP_EXECUTION: 'tester.stopExecution',
  SHOW_DEVICE_STATUS: 'tester.showDeviceStatus',
  SHOW_MESSAGE_MONITOR: 'tester.showMessageMonitor',
  SHOW_MANUAL_SEND: 'tester.showManualSend',
  CLEAR_OUTPUT: 'tester.clearOutput',
  OPEN_DEVICE: 'tester.openDevice',
} as const;

/** 视图ID */
export const VIEW_IDS = {
  DEVICE_STATUS: 'tester.deviceStatus',
  MESSAGE_MONITOR: 'tester.messageMonitor',
  MANUAL_SEND: 'tester.manualSend',
} as const;

/** 配置键 */
export const CONFIG_KEYS = {
  /** 日志级别 */
  LOG_LEVEL: 'tester.logLevel',
  /** 自动保存设备配置 */
  AUTO_SAVE_DEVICE_CONFIG: 'tester.autoSaveDeviceConfig',
  /** 报文监视器模式 */
  MESSAGE_MONITOR_MODE: 'tester.messageMonitorMode',
} as const;
