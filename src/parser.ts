/**
 * Tester语言解析器
 * 负责将Tester脚本解析为可执行的数据结构
 */

// ========== 数据类型定义 ==========

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

/** 位范围定义 */
export interface BitRange {
  startByte: number;
  startBit: number;
  endByte: number;
  endBit: number;
}

/** 测试命令联合类型 */
export type TestCommand = TcansCommand | TcanrCommand | TdelayCommand;

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

// ========== 解析器实现 ==========

export class TesterParser {
  private lines: string[] = [];
  private currentLine: number = 0;
  private errors: ParseError[] = [];

  /**
   * 解析整个文档
   */
  public parse(text: string): ParseResult {
    this.lines = text.split("\n");
    this.currentLine = 0;
    this.errors = [];

    const program: TesterProgram = {
      testSuites: [],
    };

    while (this.currentLine < this.lines.length) {
      const line = this.getCurrentLineContent();

      if (line === "tset") {
        if (program.configuration) {
          this.addError("项目中存在多个配置块");
        } else {
          program.configuration = this.parseConfigurationBlock();
        }
      } else if (line.startsWith("ttitle=") || line.startsWith("ttitle =")) {
        const suite = this.parseTestSuite();
        if (suite) {
          program.testSuites.push(suite);
        }
      } else {
        this.currentLine++;
      }
    }

    return {
      program: this.errors.length === 0 ? program : undefined,
      errors: this.errors,
    };
  }

  /**
   * 解析指定行开始的测试用例集
   */
  public parseTestSuiteAtLine(text: string, targetLine: number): TestSuite | null {
    this.lines = text.split("\n");
    this.currentLine = 0;
    this.errors = [];

    // 找到目标行
    while (this.currentLine < this.lines.length) {
      const line = this.getCurrentLineContent();
      if (this.currentLine === targetLine && (line.startsWith("ttitle=") || line.startsWith("ttitle ="))) {
        return this.parseTestSuite();
      }
      this.currentLine++;
    }

    return null;
  }

  /**
   * 解析指定行开始的测试用例
   */
  public parseTestCaseAtLine(text: string, targetLine: number): { testCase: TestCase; configuration?: ConfigurationBlock } | null {
    this.lines = text.split("\n");
    this.currentLine = 0;
    this.errors = [];

    let configuration: ConfigurationBlock | undefined;

    // 首先解析配置块
    while (this.currentLine < this.lines.length) {
      const line = this.getCurrentLineContent();
      if (line === "tset") {
        configuration = this.parseConfigurationBlock();
        break;
      } else if (line.startsWith("ttitle=") || line.startsWith("ttitle =")) {
        break;
      }
      this.currentLine++;
    }

    // 找到目标行的测试用例
    this.currentLine = 0;
    while (this.currentLine < this.lines.length) {
      const line = this.getCurrentLineContent();
      if (this.currentLine === targetLine && line.match(/^(?:\d+\s+)?\btstart\b/)) {
        const testCase = this.parseTestCase();
        if (testCase) {
          return { testCase, configuration };
        }
      }
      this.currentLine++;
    }

    return null;
  }

  /**
   * 解析配置块
   */
  private parseConfigurationBlock(): ConfigurationBlock {
    const startLine = this.currentLine;
    this.currentLine++; // 跳过 tset

    const channels: ChannelConfig[] = [];
    const diagnose: DiagnoseConfig = { dtcList: [] };
    let projectChannelIndex = 0;

    while (this.currentLine < this.lines.length) {
      const line = this.getCurrentLineContent();

      if (line === "tend") {
        const endLine = this.currentLine;
        this.currentLine++;
        return { channels, diagnose, startLine, endLine };
      }

      // 解析 tcaninit
      if (line.startsWith("tcaninit")) {
        const channel = this.parseChannelInit(line, projectChannelIndex);
        if (channel) {
          channels.push(channel);
          projectChannelIndex++;
        }
      }
      // 解析诊断配置
      else if (line.startsWith("tdiagnose_rid")) {
        const value = this.parseHexValue(line.substring("tdiagnose_rid".length).trim());
        if (value !== null) {
          diagnose.requestId = value;
        }
      } else if (line.startsWith("tdiagnose_sid")) {
        const value = this.parseHexValue(line.substring("tdiagnose_sid".length).trim());
        if (value !== null) {
          diagnose.responseId = value;
        }
      } else if (line.startsWith("tdiagnose_keyk")) {
        const value = this.parseHexValue(line.substring("tdiagnose_keyk".length).trim());
        if (value !== null) {
          diagnose.securityKey = value;
        }
      } else if (line.startsWith("tdiagnose_dtc")) {
        const dtc = this.parseDtcConfig(line);
        if (dtc) {
          diagnose.dtcList.push(dtc);
        }
      }

      this.currentLine++;
    }

    this.addError("配置块缺少结束标记 tend");
    return { channels, diagnose, startLine, endLine: this.currentLine };
  }

  /**
   * 解析通道初始化命令
   */
  private parseChannelInit(line: string, projectChannelIndex: number): ChannelConfig | null {
    const content = line.substring("tcaninit".length).trim();
    const parts = content.split(",").map((p) => p.trim());

    if (parts.length < 4) {
      this.addError(`tcaninit 参数不足，需要至少4个参数`);
      return null;
    }

    const deviceId = parseInt(parts[0], 10);
    const deviceIndex = parseInt(parts[1], 10);
    const channelIndex = parseInt(parts[2], 10);
    const arbitrationBaudrate = parseInt(parts[3], 10);
    const dataBaudrate = parts.length >= 5 ? parseInt(parts[4], 10) : undefined;

    if (isNaN(deviceId) || isNaN(deviceIndex) || isNaN(channelIndex) || isNaN(arbitrationBaudrate)) {
      this.addError(`tcaninit 参数格式错误`);
      return null;
    }

    return {
      deviceId,
      deviceIndex,
      channelIndex,
      arbitrationBaudrate,
      dataBaudrate,
      projectChannelIndex,
    };
  }

  /**
   * 解析故障码配置
   */
  private parseDtcConfig(line: string): DtcConfig | null {
    const content = line.substring("tdiagnose_dtc".length).trim();
    const commaIndex = content.indexOf(",");
    if (commaIndex === -1) {
      this.addError("tdiagnose_dtc 格式错误，缺少描述");
      return null;
    }

    return {
      code: content.substring(0, commaIndex).trim(),
      description: content.substring(commaIndex + 1).trim(),
    };
  }

  /**
   * 解析测试用例集
   */
  private parseTestSuite(): TestSuite | null {
    const startLine = this.currentLine;
    const line = this.getCurrentLineContent();
    const nameMatch = line.match(/ttitle\s*=\s*(.+)$/);
    const name = nameMatch ? nameMatch[1].trim() : "";

    this.currentLine++;

    const testCases: TestCase[] = [];

    while (this.currentLine < this.lines.length) {
      const currentLine = this.getCurrentLineContent();

      if (currentLine === "ttitle-end") {
        const endLine = this.currentLine;
        this.currentLine++;
        return { name, testCases, startLine, endLine };
      }

      // 解析测试用例
      if (currentLine.match(/^(?:\d+\s+)?\btstart\b/)) {
        const testCase = this.parseTestCase();
        if (testCase) {
          testCases.push(testCase);
        }
      } else {
        this.currentLine++;
      }
    }

    this.addError(`测试用例集 "${name}" 缺少结束标记 ttitle-end`);
    return { name, testCases, startLine, endLine: this.currentLine };
  }

  /**
   * 解析测试用例
   */
  private parseTestCase(): TestCase | null {
    const startLine = this.currentLine;
    const line = this.getCurrentLineContent();

    // 解析序号和名称: [序号] tstart=名称
    let sequenceNumber: number | undefined;
    let name = "";

    const seqMatch = line.match(/^(\d+)\s+tstart\s*=?\s*(.*)$/);
    const noSeqMatch = line.match(/^tstart\s*=?\s*(.*)$/);

    if (seqMatch) {
      sequenceNumber = parseInt(seqMatch[1], 10);
      name = seqMatch[2].trim();
    } else if (noSeqMatch) {
      name = noSeqMatch[1].trim();
    }

    this.currentLine++;

    const commands: TestCommand[] = [];

    while (this.currentLine < this.lines.length) {
      const currentLine = this.getCurrentLineContent();

      if (currentLine === "tend") {
        const endLine = this.currentLine;
        this.currentLine++;
        return { sequenceNumber, name, commands, startLine, endLine };
      }

      // 解析测试命令
      const command = this.parseCommand(currentLine);
      if (command) {
        commands.push(command);
      }

      this.currentLine++;
    }

    this.addError(`测试用例 "${name}" 缺少结束标记 tend`);
    return { sequenceNumber, name, commands, startLine, endLine: this.currentLine };
  }

  /**
   * 解析测试命令
   */
  private parseCommand(line: string): TestCommand | null {
    if (line.startsWith("tcans")) {
      return this.parseTcansCommand(line);
    } else if (line.startsWith("tcanr")) {
      return this.parseTcanrCommand(line);
    } else if (line.startsWith("tdelay")) {
      return this.parseTdelayCommand(line);
    }
    return null;
  }

  /**
   * 解析 tcans 命令
   * 格式: tcans [channel_index,]message_id,data_bytes,interval_ms,repeat_count
   */
  private parseTcansCommand(line: string): TcansCommand | null {
    const content = line.substring("tcans".length).trim();
    const parts = content.split(",").map((p) => p.trim());

    if (parts.length < 4) {
      this.addError(`tcans 参数不足`);
      return null;
    }

    let channelIndex = 0;
    let messageId: number;
    let dataStr: string;
    let intervalMs: number;
    let repeatCount: number;

    // 判断第一个参数是通道索引还是消息ID
    const firstPart = parts[0];
    const isHex = firstPart.toLowerCase().startsWith("0x");
    const firstValue = this.parseHexValue(firstPart);

    if (parts.length === 4) {
      // 无通道索引: tcans message_id,data,interval,repeat
      messageId = firstValue!;
      dataStr = parts[1];
      intervalMs = parseInt(parts[2], 10);
      repeatCount = parseInt(parts[3], 10);
    } else if (parts.length >= 5) {
      // 有通道索引: tcans channel,message_id,data,interval,repeat
      if (isHex) {
        // 如果第一个是十六进制，可能是报文ID较大的情况
        // 需要检查参数数量来判断
        channelIndex = 0;
        messageId = firstValue!;
        dataStr = parts[1];
        intervalMs = parseInt(parts[2], 10);
        repeatCount = parseInt(parts[3], 10);
      } else {
        channelIndex = parseInt(parts[0], 10);
        messageId = this.parseHexValue(parts[1])!;
        dataStr = parts[2];
        intervalMs = parseInt(parts[3], 10);
        repeatCount = parseInt(parts[4], 10);
      }
    } else {
      this.addError(`tcans 参数格式错误`);
      return null;
    }

    const data = this.parseDataBytes(dataStr);

    return {
      type: "tcans",
      channelIndex,
      messageId,
      data,
      intervalMs,
      repeatCount,
      line: this.currentLine,
    };
  }

  /**
   * 解析 tcanr 命令
   * 格式: tcanr [channel_index,]message_id,bit_range,expected_value|print,timeout_ms
   */
  private parseTcanrCommand(line: string): TcanrCommand | null {
    const content = line.substring("tcanr".length).trim();
    const parts = content.split(",").map((p) => p.trim());

    if (parts.length < 4) {
      this.addError(`tcanr 参数不足`);
      return null;
    }

    let channelIndex = 0;
    let messageId: number;
    let bitRangeStr: string;
    let expectedStr: string;
    let timeoutMs: number;

    // 判断第一个参数是通道索引还是消息ID
    const firstPart = parts[0];
    const isHex = firstPart.toLowerCase().startsWith("0x");

    if (parts.length === 4) {
      // 无通道索引
      messageId = this.parseHexValue(firstPart)!;
      bitRangeStr = parts[1];
      expectedStr = parts[2];
      timeoutMs = parseInt(parts[3], 10);
    } else if (parts.length >= 5) {
      if (isHex) {
        // 第一个是十六进制，判断为消息ID
        messageId = this.parseHexValue(firstPart)!;
        bitRangeStr = parts[1];
        expectedStr = parts[2];
        timeoutMs = parseInt(parts[3], 10);
      } else {
        // 有通道索引
        channelIndex = parseInt(parts[0], 10);
        messageId = this.parseHexValue(parts[1])!;
        bitRangeStr = parts[2];
        expectedStr = parts[3];
        timeoutMs = parseInt(parts[4], 10);
      }
    } else {
      this.addError(`tcanr 参数格式错误`);
      return null;
    }

    const bitRanges = this.parseBitRanges(bitRangeStr);
    const expectedValues = expectedStr.toLowerCase() === "print" ? "print" : this.parseExpectedValues(expectedStr);

    return {
      type: "tcanr",
      channelIndex,
      messageId,
      bitRanges,
      expectedValues,
      timeoutMs,
      line: this.currentLine,
    };
  }

  /**
   * 解析 tdelay 命令
   */
  private parseTdelayCommand(line: string): TdelayCommand | null {
    const content = line.substring("tdelay".length).trim();
    const delayMs = parseInt(content, 10);

    if (isNaN(delayMs)) {
      this.addError(`tdelay 参数格式错误`);
      return null;
    }

    return {
      type: "tdelay",
      delayMs,
      line: this.currentLine,
    };
  }

  /**
   * 解析位范围字符串
   * 格式: byte.bit-byte.bit[+byte.bit-byte.bit...]
   */
  private parseBitRanges(str: string): BitRange[] {
    const ranges: BitRange[] = [];
    const parts = str.split("+");

    for (const part of parts) {
      const range = this.parseSingleBitRange(part.trim());
      if (range) {
        ranges.push(range);
      }
    }

    return ranges;
  }

  /**
   * 解析单个位范围
   */
  private parseSingleBitRange(str: string): BitRange | null {
    const match = str.match(/^(\d+)\.(\d+)-(\d+)\.(\d+)$/);
    if (!match) {
      this.addError(`位范围格式错误: ${str}`);
      return null;
    }

    return {
      startByte: parseInt(match[1], 10),
      startBit: parseInt(match[2], 10),
      endByte: parseInt(match[3], 10),
      endBit: parseInt(match[4], 10),
    };
  }

  /**
   * 解析期望值字符串
   */
  private parseExpectedValues(str: string): number[] {
    const parts = str.split("+");
    return parts.map((p) => this.parseHexValue(p.trim()) ?? 0);
  }

  /**
   * 解析数据字节字符串
   * 格式: XX-XX-XX 或 XX XX XX
   */
  private parseDataBytes(str: string): number[] {
    const parts = str.split(/[-\s]+/);
    return parts.map((p) => parseInt(p, 16)).filter((n) => !isNaN(n));
  }

  /**
   * 解析十六进制或十进制值
   */
  private parseHexValue(str: string): number | null {
    str = str.trim();
    if (str.toLowerCase().startsWith("0x")) {
      return parseInt(str, 16);
    }
    return parseInt(str, 10);
  }

  /**
   * 获取当前行内容（去除注释和空白）
   */
  private getCurrentLineContent(): string {
    if (this.currentLine >= this.lines.length) {
      return "";
    }
    let line = this.lines[this.currentLine];
    // 移除注释
    const commentIndex = line.indexOf("//");
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex);
    }
    return line.trim();
  }

  /**
   * 添加错误
   */
  private addError(message: string): void {
    this.errors.push({
      line: this.currentLine,
      message,
    });
  }
}
