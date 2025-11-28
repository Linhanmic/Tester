import * as vscode from "vscode";
import { TesterParser } from "./parser";

interface ValidationError {
  line: number;
  message: string;
  severity: vscode.DiagnosticSeverity;
  startChar?: number;
  endChar?: number;
}

export class TesterValidator {
  // 诊断集合用于存储和显示验证结果
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(diagnosticCollection: vscode.DiagnosticCollection) {
    this.diagnosticCollection = diagnosticCollection;
  }

  public validateDocument(document: vscode.TextDocument): void {
    const config = vscode.workspace.getConfiguration("tester");
    if (!config.get<boolean>("validation.enable", true)) {
      return;
    }

    const errors: ValidationError[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    // 预处理：删除//之后的注释内容，防止干扰关键字匹配
    for (let i = 0; i < lines.length; i++) {
      const commentIndex = lines[i].indexOf("//");
      if (commentIndex !== -1) {
        lines[i] = lines[i].substring(0, commentIndex).trimEnd();
      }
    }

    // 核心校验：只校验块结构的配对情况
    this.validateBlockPairing(lines, errors);

    // 位域函数参数校验
    this.validateBitFieldCalls(text, lines, errors);

    // 转换为诊断信息
    const diagnostics: vscode.Diagnostic[] = errors.map((error) => {
      const line = document.lineAt(error.line);
      // 如果提供了具体的字符位置，使用它；否则定位到整行
      const range = error.startChar !== undefined && error.endChar !== undefined
        ? new vscode.Range(error.line, error.startChar, error.line, error.endChar)
        : new vscode.Range(error.line, 0, error.line, line.text.length);

      const diagnostic = new vscode.Diagnostic(
        range,
        error.message,
        error.severity
      );
      diagnostic.source = "Tester";
      return diagnostic;
    });

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /**
   * 仅校验 tset/tend, tstart/tend, ttitle/ttitle-end 的配对和嵌套关系。
   */
  private validateBlockPairing(
    lines: string[],
    errors: ValidationError[]
  ): void {
    // 使用栈来追踪未闭合的块结构
    interface BlockInfo {
      type: "ttitle" | "tstart" | "tset";
      line: number;
      name?: string; // 用于ttitle的错误提示
    }
    const stack: BlockInfo[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 1. tset 块开始
      if (line === "tset") {
        stack.push({ type: "tset", line: i });
      }
      // 2. ttitle 块开始 (使用正则匹配，兼容 ttitle=Name 和 ttitle = Name)
      else if (line.match(/\bttitle\b\s*=\s*(.*)$/)) {
        // 提取名称用于错误提示
        const match = line.match(/\bttitle\b\s*=\s*(.*)$/);
        const name = match ? match[1].trim() : "未命名";
        stack.push({ type: "ttitle", line: i, name });
      }
      // 3. tstart 块开始 (支持数字序号，兼容 1 tstart = ... )
      else if (line.match(/^(?:\d+\s+)?\btstart\b/)) {
        stack.push({ type: "tstart", line: i });
      }
      // 4. tend 块结束 (闭合 tset 或 tstart)
      else if (line === "tend") {
        let found = false;
        // 从栈顶向下查找最近的 tstart 或 tset
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].type === "tstart" || stack[j].type === "tset") {
            stack.splice(j, 1); // 找到匹配，移除
            found = true;
            break;
          }
        }
        if (!found) {
          errors.push({
            line: i,
            message: "找到tend但没有对应的tstart或tset开始标记",
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
      }
      // 5. ttitle-end 块结束 (闭合 ttitle)
      else if (line === "ttitle-end") {
        let found = false;
        // 从栈顶向下查找最近的 ttitle
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].type === "ttitle") {
            stack.splice(j, 1); // 找到匹配，移除
            found = true;
            break;
          }
        }
        if (!found) {
          errors.push({
            line: i,
            message: "找到ttitle-end但没有对应的ttitle开始标记",
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
      }
    }

    // 检查栈中剩余的未配对项 (缺少结束标记)
    for (const block of stack) {
      if (block.type === "ttitle") {
        errors.push({
          line: block.line,
          message: `测试用例集"${
            block.name || "未命名"
          }"缺少结束标记ttitle-end`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      } else if (block.type === "tstart") {
        errors.push({
          line: block.line,
          message: "测试用例缺少结束标记tend",
          severity: vscode.DiagnosticSeverity.Error,
        });
      } else if (block.type === "tset") {
        errors.push({
          line: block.line,
          message: "配置块缺少结束标记tend",
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    }
  }

  /**
   * 校验位域函数调用的参数
   */
  private validateBitFieldCalls(
    text: string,
    lines: string[],
    errors: ValidationError[]
  ): void {
    // 使用解析器解析文档
    const parser = new TesterParser();
    const parseResult = parser.parse(text);

    if (parseResult.errors.length > 0 || !parseResult.program) {
      // 如果解析失败，跳过位域函数校验
      return;
    }

    const enums = parseResult.program.enums;
    const bitFieldFunctions = parseResult.program.bitFieldFunctions;

    // 遍历每一行查找位域函数调用
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex].trim();

      // 跳过空行、注释行和定义行
      if (
        !line ||
        line.startsWith("//") ||
        line.startsWith("tenum") ||
        line.startsWith("tbitfield") ||
        line.startsWith("tset") ||
        line.startsWith("ttitle") ||
        line.startsWith("tstart") ||
        line.startsWith("tcans") ||
        line.startsWith("tcanr") ||
        line.startsWith("tdelay") ||
        line.startsWith("tconfirm") ||
        line.startsWith("tdiagnose") ||
        line === "tend" ||
        line === "ttitle-end"
      ) {
        continue;
      }

      // 尝试匹配位域函数调用: 函数名 参数1=值1, 参数2=值2
      const callMatch = line.match(/^(\w+)\s+(.+)$/);
      if (!callMatch) {
        continue;
      }

      const [, funcName, argsStr] = callMatch;

      // 检查函数是否存在
      const funcDef = bitFieldFunctions.get(funcName);
      if (!funcDef) {
        // 这可能不是位域函数调用，跳过
        continue;
      }

      // 解析参数
      const providedParams = new Map<string, string>();
      const paramMatches = argsStr.matchAll(/(\w+)\s*=\s*([^,]+)/g);

      for (const match of paramMatches) {
        const paramName = match[1].trim();
        const paramValue = match[2].trim();
        providedParams.set(paramName, paramValue);
      }

      // 检查必需参数是否都提供了
      const requiredParams = funcDef.parameters;
      requiredParams.forEach((internalName, displayName) => {
        if (!providedParams.has(displayName)) {
          // 计算错误位置
          const originalLine = lines[lineIndex];
          const funcNameIndex = originalLine.indexOf(funcName);

          errors.push({
            line: lineIndex,
            message: `位域函数"${funcName}"缺少必需参数: ${displayName}`,
            severity: vscode.DiagnosticSeverity.Error,
            startChar: funcNameIndex,
            endChar: funcNameIndex + funcName.length,
          });
        }
      });

      // 检查枚举值是否有效
      providedParams.forEach((value, paramDisplayName) => {
        const internalName = requiredParams.get(paramDisplayName);
        if (!internalName) {
          // 参数名不存在
          const originalLine = lines[lineIndex];
          const paramIndex = originalLine.indexOf(paramDisplayName);

          errors.push({
            line: lineIndex,
            message: `位域函数"${funcName}"不接受参数: ${paramDisplayName}`,
            severity: vscode.DiagnosticSeverity.Error,
            startChar: paramIndex,
            endChar: paramIndex + paramDisplayName.length,
          });
          return;
        }

        // 检查是否为枚举值
        let enumFound = false;
        let isValidEnumValue = false;

        enums.forEach((enumDef, enumName) => {
          // 检查内部名称是否包含枚举名
          if (
            internalName.includes(enumName) ||
            enumName.includes(internalName)
          ) {
            enumFound = true;

            // 检查提供的值是否在枚举中
            enumDef.values.forEach((displayValue, numericValue) => {
              if (displayValue === value || numericValue.toString() === value) {
                isValidEnumValue = true;
              }
            });
          }
        });

        // 如果找到了对应的枚举但值无效
        if (enumFound && !isValidEnumValue) {
          const originalLine = lines[lineIndex];
          const valueIndex = originalLine.indexOf(value, originalLine.indexOf(paramDisplayName));

          // 获取有效的枚举值列表
          const validValues: string[] = [];
          enums.forEach((enumDef, enumName) => {
            if (
              internalName.includes(enumName) ||
              enumName.includes(internalName)
            ) {
              enumDef.values.forEach((displayValue) => {
                validValues.push(displayValue);
              });
            }
          });

          errors.push({
            line: lineIndex,
            message: `无效的枚举值"${value}"，有效值为: ${validValues.join(", ")}`,
            severity: vscode.DiagnosticSeverity.Error,
            startChar: valueIndex,
            endChar: valueIndex + value.length,
          });
        }
      });
    }
  }
}
