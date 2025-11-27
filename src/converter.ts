/**
 * 脚本转换器
 * 将包含位域函数语法的脚本转换为原始的tcans指令脚本
 */

import {
  TesterParser,
  TesterProgram,
  TestSuite,
  TestCase,
  TestCommand,
  BitFieldCallCommand,
  TcansCommand,
  EnumDefinition,
  BitFieldFunction,
  BitFieldMapping,
  BitRange,
} from "./parser";

export class ScriptConverter {
  private parser: TesterParser;
  private enums: Map<string, EnumDefinition> = new Map();
  private bitFieldFunctions: Map<string, BitFieldFunction> = new Map();

  constructor() {
    this.parser = new TesterParser();
  }

  /**
   * 将脚本转换为原始指令格式
   */
  public convert(sourceText: string): string {
    const parseResult = this.parser.parse(sourceText);

    if (!parseResult.program || parseResult.errors.length > 0) {
      throw new Error(`解析失败: ${parseResult.errors.map(e => e.message).join(", ")}`);
    }

    const program = parseResult.program;
    this.enums = program.enums;
    this.bitFieldFunctions = program.bitFieldFunctions;

    const lines: string[] = [];

    // 添加文件头注释
    lines.push("// ================================================================");
    lines.push("// 自动生成的原始指令脚本");
    lines.push("// 由位域函数语法转换而来");
    lines.push("// 生成时间: " + new Date().toLocaleString("zh-CN"));
    lines.push("// ================================================================");
    lines.push("");

    // 如果有枚举定义，添加注释说明
    if (this.enums.size > 0) {
      lines.push("// ========== 枚举定义 ==========");
      for (const [name, enumDef] of this.enums) {
        lines.push(`// tenum ${name}`);
        const values: string[] = [];
        for (const [num, str] of enumDef.values) {
          values.push(`${num}=${str}`);
        }
        lines.push(`//   ${values.join(", ")}`);
      }
      lines.push("");
    }

    // 如果有位域函数定义，添加注释说明
    if (this.bitFieldFunctions.size > 0) {
      lines.push("// ========== 位域函数定义 ==========");
      for (const [name, funcDef] of this.bitFieldFunctions) {
        lines.push(`// tbitfield ${name}`);
        lines.push(`//   CAN ID: 0x${funcDef.canId.toString(16).toUpperCase()}`);
        const params: string[] = [];
        for (const [paramName, displayName] of funcDef.parameters) {
          params.push(`${paramName}="${displayName}"`);
        }
        lines.push(`//   参数: ${params.join(", ")}`);
      }
      lines.push("");
    }

    // 添加配置块
    if (program.configuration) {
      lines.push("// ========== 设备配置 ==========");
      lines.push("tset");
      for (const channel of program.configuration.channels) {
        const params = [
          channel.deviceId,
          channel.deviceIndex,
          channel.channelIndex,
          channel.arbitrationBaudrate,
        ];
        if (channel.dataBaudrate !== undefined) {
          params.push(channel.dataBaudrate);
        }
        lines.push(`  tcaninit ${params.join(", ")}`);
      }
      lines.push("tend");
      lines.push("");
    }

    // 转换测试用例集
    for (const suite of program.testSuites) {
      lines.push(...this.convertTestSuite(suite));
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 转换测试用例集
   */
  private convertTestSuite(suite: TestSuite): string[] {
    const lines: string[] = [];

    lines.push(`ttitle=${suite.name}`);
    lines.push("");

    for (const testCase of suite.testCases) {
      lines.push(...this.convertTestCase(testCase));
      lines.push("");
    }

    lines.push("ttitle-end");

    return lines;
  }

  /**
   * 转换测试用例
   */
  private convertTestCase(testCase: TestCase): string[] {
    const lines: string[] = [];

    // 测试用例开始
    if (testCase.sequenceNumber !== undefined) {
      lines.push(`  ${testCase.sequenceNumber} tstart=${testCase.name}`);
    } else {
      lines.push(`  tstart=${testCase.name}`);
    }

    // 转换命令
    for (const command of testCase.commands) {
      if (command.type === "bitfield_call") {
        lines.push(...this.convertBitFieldCall(command));
      } else {
        lines.push(this.convertCommand(command));
      }
    }

    lines.push("  tend");

    return lines;
  }

  /**
   * 转换位域函数调用为tcans命令
   */
  private convertBitFieldCall(command: BitFieldCallCommand): string[] {
    const lines: string[] = [];
    const funcDef = this.bitFieldFunctions.get(command.functionName);

    if (!funcDef) {
      throw new Error(`未定义的位域函数: ${command.functionName}`);
    }

    // 添加注释说明原始的函数调用
    const argsStr = Array.from(command.arguments.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    lines.push(`    // ${command.functionName} ${argsStr}`);

    // 生成CAN数据
    const data = new Array(8).fill(0);

    // 创建显示名到参数名的映射
    const displayNameToParam = new Map<string, string>();
    for (const [paramName, displayName] of funcDef.parameters) {
      displayNameToParam.set(displayName, paramName);
    }

    for (const mapping of funcDef.mappings) {
      // mapping.paramName存储的是显示名，需要转换为实际的参数名
      const actualParamName = displayNameToParam.get(mapping.paramName);
      if (!actualParamName) {
        throw new Error(`位域映射的参数名 "${mapping.paramName}" 未在函数定义中找到`);
      }

      const argValue = command.arguments.get(actualParamName);
      if (argValue === undefined) {
        throw new Error(`缺少参数: ${actualParamName}`);
      }

      let numValue: number = 0;
      if (typeof argValue === "string") {
        // 查找枚举值
        let found = false;
        for (const [enumName, enumDef] of this.enums) {
          for (const [num, name] of enumDef.values) {
            if (name === argValue) {
              numValue = num;
              found = true;
              break;
            }
          }
          if (found) {
            break;
          }
        }
        if (!found) {
          throw new Error(`未找到枚举值: ${argValue}`);
        }
      } else {
        numValue = argValue;
      }

      // 应用缩放因子
      if (mapping.scale) {
        numValue = Math.round(numValue * mapping.scale);
      }

      // 写入位域
      this.writeBitRange(data, mapping.bitRange, numValue);
    }

    // 生成tcans命令
    const dataStr = data
      .map(b => b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
    const canIdStr = funcDef.canId.toString(16).toUpperCase();
    lines.push(`    tcans 0x${canIdStr}, ${dataStr}, 0, 1`);

    return lines;
  }

  /**
   * 转换其他命令
   */
  private convertCommand(command: TestCommand): string {
    switch (command.type) {
      case "tcans": {
        const dataStr = command.data
          .map(b => b.toString(16).padStart(2, "0").toUpperCase())
          .join(" ");
        const canIdStr = command.messageId.toString(16).toUpperCase();
        return `    tcans 0x${canIdStr}, ${dataStr}, ${command.intervalMs}, ${command.repeatCount}`;
      }
      case "tcanr": {
        // tcanr命令格式较复杂，包含位域和期望值
        // 简化处理：输出基本格式的注释
        const canIdStr = command.messageId.toString(16).toUpperCase();
        const expectedStr = command.expectedValues === "print" ? "print" : command.expectedValues.join(",");
        // 位域格式化
        const bitRangeStrs = command.bitRanges.map(r =>
          `${r.startByte}.${r.startBit}-${r.endByte}.${r.endBit}`
        );
        return `    tcanr 0x${canIdStr}, ${bitRangeStrs.join("+")}, ${expectedStr}, ${command.timeoutMs}`;
      }
      case "tdelay":
        return `    tdelay ${command.delayMs}`;
      case "tconfirm":
        return `    tconfirm ${command.message}`;
      default:
        return `    // 未知命令类型`;
    }
  }

  /**
   * 将值写入位域（Intel字节序）
   */
  private writeBitRange(data: number[], range: BitRange, value: number): void {
    const startByte = range.startByte - 1; // 转换为0基索引
    const startBit = range.startBit;
    const endByte = range.endByte - 1;
    const endBit = range.endBit;

    // 计算信号长度
    const signalLength = (endByte - startByte) * 8 + (endBit - startBit) + 1;

    // Intel字节序：低位字节在前
    let currentBitPos = startByte * 8 + startBit;

    for (let i = 0; i < signalLength; i++) {
      // 检查当前信号位是否为1
      if (value & (1 << i)) {
        // 计算在CAN数据中的字节和位位置
        const byteIdx = Math.floor(currentBitPos / 8);
        const bitIdx = currentBitPos % 8;

        if (byteIdx >= 8) {
          throw new Error(`位位置超出8字节范围: ${byteIdx}`);
        }

        // 设置对应位为1
        data[byteIdx] |= (1 << bitIdx);
      }

      currentBitPos++;
    }
  }
}
