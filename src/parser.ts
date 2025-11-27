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

/** 枚举定义 */
export interface EnumDefinition {
  name: string;
  values: Map<number, string>; // 数值 -> 名称映射
  line: number;
}

/** 位域映射 */
export interface BitFieldMapping {
  bitRange: BitRange;
  paramName: string; // 对应的参数名
  scale?: number; // 缩放因子 (例如: /100 表示 scale=100)
}

/** 位域函数定义 */
export interface BitFieldFunction {
  name: string;
  parameters: Map<string, string>; // 参数名 -> 显示名映射
  canId: number;
  mappings: BitFieldMapping[];
  line: number;
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

/** 位域函数调用命令 */
export interface BitFieldCallCommand {
  type: "bitfield_call";
  functionName: string;
  arguments: Map<string, number | string>; // 参数名 -> 值
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
export type TestCommand = TcansCommand | TcanrCommand | TdelayCommand | TconfirmCommand | BitFieldCallCommand;

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
  enums: Map<string, EnumDefinition>; // 枚举定义
  bitFieldFunctions: Map<string, BitFieldFunction>; // 位域函数定义
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
  private currentProgram: TesterProgram | null = null; // 当前解析的程序

  /**
   * 解析整个文档
   */
  public parse(text: string): ParseResult {
    this.lines = text.split("\n");
    this.currentLine = 0;
    this.errors = [];

    const program: TesterProgram = {
      enums: new Map(),
      bitFieldFunctions: new Map(),
      testSuites: [],
    };
    this.currentProgram = program;

    while (this.currentLine < this.lines.length) {
      const line = this.getCurrentLineContent();

      if (line === "tset") {
        if (program.configuration) {
          this.addError("项目中存在多个配置块");
        } else {
          program.configuration = this.parseConfigurationBlock();
        }
      } else if (line.startsWith("tenum ")) {
        const enumDef = this.parseEnumDefinition(line);
        if (enumDef) {
          if (program.enums.has(enumDef.name)) {
            this.addError(`枚举 "${enumDef.name}" 重复定义`);
          } else {
            program.enums.set(enumDef.name, enumDef);
          }
        }
        this.currentLine++;
      } else if (line.startsWith("tbitfield ")) {
        const funcDef = this.parseBitFieldFunction(line);
        if (funcDef) {
          if (program.bitFieldFunctions.has(funcDef.name)) {
            this.addError(`位域函数 "${funcDef.name}" 重复定义`);
          } else {
            program.bitFieldFunctions.set(funcDef.name, funcDef);
          }
        }
        this.currentLine++;
      } else if (line.startsWith("ttitle=") || line.startsWith("ttitle =")) {
        const suite = this.parseTestSuite();
        if (suite) {
          program.testSuites.push(suite);
        }
      } else {
        this.currentLine++;
      }
    }

    this.currentProgram = null;

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
      // 解析诊断配置（支持省略0x前缀，默认视为十六进制）
      else if (line.startsWith("tdiagnose_rid")) {
        const value = this.parseHexValueDefaultHex(line.substring("tdiagnose_rid".length).trim());
        if (value !== null) {
          diagnose.requestId = value;
        }
      } else if (line.startsWith("tdiagnose_sid")) {
        const value = this.parseHexValueDefaultHex(line.substring("tdiagnose_sid".length).trim());
        if (value !== null) {
          diagnose.responseId = value;
        }
      } else if (line.startsWith("tdiagnose_keyk")) {
        const value = this.parseHexValueDefaultHex(line.substring("tdiagnose_keyk".length).trim());
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
   * 解析枚举定义
   * 格式: tenum 枚举名 值1=键1, 值2=键2, ...
   * 示例: tenum 车速单位 0=km/h, 1=mph, 2=m/s
   */
  private parseEnumDefinition(line: string): EnumDefinition | null {
    const content = line.substring("tenum".length).trim();
    const parts = content.split(/\s+/);

    if (parts.length < 2) {
      this.addError("tenum 格式错误，缺少枚举名或枚举值");
      return null;
    }

    const enumName = parts[0];
    const valuesStr = parts.slice(1).join(" ");
    const valuePairs = valuesStr.split(",").map(p => p.trim());

    const values = new Map<number, string>();
    for (const pair of valuePairs) {
      const eqIndex = pair.indexOf("=");
      if (eqIndex === -1) {
        this.addError(`枚举值格式错误: ${pair}`);
        continue;
      }

      const numStr = pair.substring(0, eqIndex).trim();
      const nameStr = pair.substring(eqIndex + 1).trim();
      const num = parseInt(numStr, 10);

      if (isNaN(num)) {
        this.addError(`枚举值不是有效数字: ${numStr}`);
        continue;
      }

      values.set(num, nameStr);
    }

    return {
      name: enumName,
      values,
      line: this.currentLine,
    };
  }

  /**
   * 解析位域函数定义
   * 格式: tbitfield 函数名 参数1="显示名1", 参数2="显示名2": CAN_ID, 位域1="参数1"/缩放, 位域2="参数2"
   * 示例: tbitfield 车速 车速值="车速值", 车速单位="车速单位": 144, 1.0-2.7="车速值"/100, 3.0-3.1="车速单位"
   */
  private parseBitFieldFunction(line: string): BitFieldFunction | null {
    const content = line.substring("tbitfield".length).trim();

    // 找到冒号位置，分割参数定义和位域映射
    const colonIndex = content.indexOf(":");
    if (colonIndex === -1) {
      this.addError("tbitfield 格式错误，缺少冒号分隔符");
      return null;
    }

    const paramSection = content.substring(0, colonIndex).trim();
    const mappingSection = content.substring(colonIndex + 1).trim();

    // 解析函数名和参数
    const paramParts = paramSection.split(/\s+/);
    if (paramParts.length < 2) {
      this.addError("tbitfield 格式错误，缺少函数名或参数");
      return null;
    }

    const funcName = paramParts[0];
    const paramsStr = paramParts.slice(1).join(" ");
    const paramPairs = paramsStr.split(",").map(p => p.trim());

    const parameters = new Map<string, string>();
    for (const pair of paramPairs) {
      const eqIndex = pair.indexOf("=");
      if (eqIndex === -1) {
        this.addError(`参数格式错误: ${pair}`);
        continue;
      }

      const paramName = pair.substring(0, eqIndex).trim();
      let displayName = pair.substring(eqIndex + 1).trim();

      // 移除引号
      if ((displayName.startsWith('"') && displayName.endsWith('"')) ||
          (displayName.startsWith("'") && displayName.endsWith("'"))) {
        displayName = displayName.substring(1, displayName.length - 1);
      }

      parameters.set(paramName, displayName);
    }

    // 解析CAN ID和位域映射
    const mappingParts = mappingSection.split(",").map(p => p.trim());
    if (mappingParts.length < 2) {
      this.addError("tbitfield 格式错误，缺少CAN ID或位域映射");
      return null;
    }

    const canId = this.parseHexValueDefaultHex(mappingParts[0]);
    if (canId === null) {
      this.addError(`无效的CAN ID: ${mappingParts[0]}`);
      return null;
    }

    const mappings: BitFieldMapping[] = [];
    for (let i = 1; i < mappingParts.length; i++) {
      const mappingStr = mappingParts[i];
      const mapping = this.parseBitFieldMapping(mappingStr);
      if (mapping) {
        mappings.push(mapping);
      }
    }

    return {
      name: funcName,
      parameters,
      canId,
      mappings,
      line: this.currentLine,
    };
  }

  /**
   * 解析位域映射
   * 格式: 位域="参数名"/缩放
   * 示例: 1.0-2.7="车速值"/100
   */
  private parseBitFieldMapping(str: string): BitFieldMapping | null {
    // 找到等号位置
    const eqIndex = str.indexOf("=");
    if (eqIndex === -1) {
      this.addError(`位域映射格式错误: ${str}`);
      return null;
    }

    const bitRangeStr = str.substring(0, eqIndex).trim();
    let valueStr = str.substring(eqIndex + 1).trim();

    // 提取参数名和缩放因子
    let paramName = valueStr;
    let scale: number | undefined;

    // 移除引号
    if ((paramName.startsWith('"') && paramName.includes('"', 1)) ||
        (paramName.startsWith("'") && paramName.includes("'", 1))) {
      const closeQuoteIndex = paramName.indexOf(paramName[0], 1);
      paramName = paramName.substring(1, closeQuoteIndex);

      // 检查是否有缩放因子
      const remainder = valueStr.substring(closeQuoteIndex + 1).trim();
      if (remainder.startsWith("/")) {
        const scaleStr = remainder.substring(1).trim();
        scale = parseInt(scaleStr, 10);
        if (isNaN(scale)) {
          this.addError(`无效的缩放因子: ${scaleStr}`);
          scale = undefined;
        }
      }
    }

    // 解析位范围
    const bitRange = this.parseSingleBitRange(bitRangeStr);
    if (!bitRange) {
      return null;
    }

    return {
      bitRange,
      paramName,
      scale,
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
    } else if (line.startsWith("tconfirm")) {
      return this.parseTconfirmCommand(line);
    } else if (this.currentProgram) {
      // 尝试匹配位域函数调用
      const funcCall = this.parseBitFieldCall(line);
      if (funcCall) {
        return funcCall;
      }
    }
    return null;
  }

  /**
   * 解析位域函数调用
   * 格式: 函数名 参数1=值1, 参数2=值2, ...
   * 示例: 车速 车速值=100, 车速单位=km/h
   */
  private parseBitFieldCall(line: string): BitFieldCallCommand | null {
    if (!this.currentProgram) {
      return null;
    }

    // 提取函数名（第一个空格之前的内容）
    const spaceIndex = line.indexOf(" ");
    if (spaceIndex === -1) {
      return null;
    }

    const funcName = line.substring(0, spaceIndex).trim();
    const argsStr = line.substring(spaceIndex + 1).trim();

    // 检查是否存在这个位域函数定义
    const funcDef = this.currentProgram.bitFieldFunctions.get(funcName);
    if (!funcDef) {
      return null; // 不是位域函数调用
    }

    // 解析参数
    const argPairs = argsStr.split(",").map(p => p.trim());
    const args = new Map<string, number | string>();

    for (const pair of argPairs) {
      const eqIndex = pair.indexOf("=");
      if (eqIndex === -1) {
        this.addError(`参数格式错误: ${pair}`);
        continue;
      }

      const paramName = pair.substring(0, eqIndex).trim();
      const valueStr = pair.substring(eqIndex + 1).trim();

      // 检查参数是否在函数定义中
      if (!funcDef.parameters.has(paramName)) {
        this.addError(`未定义的参数: ${paramName}`);
        continue;
      }

      // 尝试解析为数字，如果失败则保存为字符串（枚举值）
      const numValue = parseFloat(valueStr);
      if (!isNaN(numValue)) {
        args.set(paramName, numValue);
      } else {
        args.set(paramName, valueStr);
      }
    }

    return {
      type: "bitfield_call",
      functionName: funcName,
      arguments: args,
      line: this.currentLine,
    };
  }

  /**
   * 解析 tcans 命令
   * 格式: tcans [channel_index,]message_id,data_bytes,interval_ms,repeat_count
   * 注意：报文ID可以省略0x前缀，默认视为十六进制
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

    if (parts.length === 4) {
      // 无通道索引: tcans message_id,data,interval,repeat
      messageId = this.parseHexValueDefaultHex(parts[0])!;
      dataStr = parts[1];
      intervalMs = parseInt(parts[2], 10);
      repeatCount = parseInt(parts[3], 10);
    } else if (parts.length >= 5) {
      // 有通道索引: tcans channel,message_id,data,interval,repeat
      // 判断第一个参数是通道索引还是报文ID：
      // 如果第二个参数包含'-'（数据字节格式），则第一个是报文ID
      // 否则第一个是通道索引
      const secondPart = parts[1];
      const isSecondDataBytes = secondPart.includes("-");

      if (isSecondDataBytes) {
        // 第二个参数是数据字节，说明第一个是报文ID（省略了通道索引）
        channelIndex = 0;
        messageId = this.parseHexValueDefaultHex(parts[0])!;
        dataStr = parts[1];
        intervalMs = parseInt(parts[2], 10);
        repeatCount = parseInt(parts[3], 10);
      } else {
        // 第一个是通道索引
        channelIndex = parseInt(parts[0], 10);
        messageId = this.parseHexValueDefaultHex(parts[1])!;
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
   * 注意：报文ID可以省略0x前缀，但期待值如果是16进制必须加上0x前缀
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

    if (parts.length === 4) {
      // 无通道索引
      messageId = this.parseHexValueDefaultHex(parts[0])!;
      bitRangeStr = parts[1];
      expectedStr = parts[2];
      timeoutMs = parseInt(parts[3], 10);
    } else if (parts.length >= 5) {
      // 判断第一个参数是通道索引还是报文ID：
      // 如果第二个参数包含'.'（位范围格式），则第一个是报文ID
      // 否则第一个是通道索引
      const secondPart = parts[1];
      const isSecondBitRange = secondPart.includes(".");

      if (isSecondBitRange) {
        // 第二个参数是位范围，说明第一个是报文ID（省略了通道索引）
        channelIndex = 0;
        messageId = this.parseHexValueDefaultHex(parts[0])!;
        bitRangeStr = parts[1];
        expectedStr = parts[2];
        timeoutMs = parseInt(parts[3], 10);
      } else {
        // 第一个是通道索引
        channelIndex = parseInt(parts[0], 10);
        messageId = this.parseHexValueDefaultHex(parts[1])!;
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
   * 解析 tconfirm 命令
   * 格式: tconfirm 提示信息
   */
  private parseTconfirmCommand(line: string): TconfirmCommand | null {
    const content = line.substring("tconfirm".length).trim();

    if (!content) {
      this.addError(`tconfirm 缺少提示信息`);
      return null;
    }

    return {
      type: "tconfirm",
      message: content,
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
   * 解析十六进制值（支持省略0x前缀，默认视为十六进制）
   * 根据规范：报文ID、诊断请求ID、诊断响应ID、tdiagnose_keyk等可以省略0x前缀
   */
  private parseHexValueDefaultHex(str: string): number | null {
    str = str.trim();
    if (str.toLowerCase().startsWith("0x")) {
      return parseInt(str, 16);
    }
    // 省略0x前缀，默认视为十六进制
    return parseInt(str, 16);
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
