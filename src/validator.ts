import * as vscode from "vscode";

interface ValidationError {
  line: number;
  message: string;
  severity: vscode.DiagnosticSeverity;
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

    // 获取细粒度规则配置
    const rules = config.get<any>("validation.rules", {
      configBlock: true,
      testSuites: true,
      canInit: true,
      diagnoseConfig: true,
      tcans: true,
      tcanr: true,
      tdelay: true,
    });

    // 验证配置块
    if (rules.configBlock !== false) {
      this.validateConfigBlock(lines, errors, rules);
    }

    // 验证测试用例集
    if (rules.testSuites !== false) {
      this.validateTestSuites(lines, errors);
    }

    // 验证命令语法
    this.validateCommands(lines, errors, rules);

    // 转换为诊断信息
    const diagnostics: vscode.Diagnostic[] = errors.map((error) => {
      const line = document.lineAt(error.line);
      const range = new vscode.Range(
        error.line,
        0,
        error.line,
        line.text.length
      );
      // 创建诊断对象{范围,消息,严重性}
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

  private validateConfigBlock(
    lines: string[],
    errors: ValidationError[],
    rules: any
  ): void {
    const tsetLines: number[] = [];
    const tendLines: number[] = [];
    let inConfigBlock = false;
    let hasChannelInit = false;
    let configBlockStart = -1;

    // 第一遍：收集所有tset和tend的位置
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === "tset") {
        tsetLines.push(i);
        if (configBlockStart === -1) {
          configBlockStart = i;
        }

        // 检查是否在文件开始处（忽略注释和tnote）
        const beforeText = lines
          .slice(0, i)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("//"))
          .join("");
        if (beforeText) {
          errors.push({
            line: i,
            message: "配置块必须位于文件开始处(注释除外)",
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
      } else if (line === "tend") {
        tendLines.push(i);
      }
    }

    // 检查tset重复
    if (tsetLines.length > 1) {
      for (let i = 1; i < tsetLines.length; i++) {
        errors.push({
          line: tsetLines[i],
          message: `重复的配置块开始标记(第一个tset在第${tsetLines[0] + 1}行)`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    }

    // 检查配对关系
    if (tsetLines.length === 1 && tendLines.length === 0) {
      errors.push({
        line: tsetLines[0],
        message: "配置块缺少结束标记tend",
        severity: vscode.DiagnosticSeverity.Error,
      });
    } else if (tsetLines.length === 0 && tendLines.length > 0) {
      errors.push({
        line: tendLines[0],
        message: "找到tend但没有对应的tset开始标记",
        severity: vscode.DiagnosticSeverity.Error,
      });
    }

    // 第二遍：验证配置块内的命令
    inConfigBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === "tset") {
        inConfigBlock = true;
      } else if (line === "tend" && inConfigBlock) {
        inConfigBlock = false;
      } else if (inConfigBlock) {
        if (line.startsWith("tcaninit")) {
          hasChannelInit = true;
          if (rules.canInit !== false) {
            this.validateCanInit(line, i, errors);
          }
        } else if (line.startsWith("tdiagnose_")) {
          if (rules.diagnoseConfig !== false) {
            this.validateDiagnoseConfig(line, i, errors);
          }
        } else if (
          line &&
          !line.startsWith("//") &&
          !line.startsWith("tnote") &&
          line !== "tset"
        ) {
          // 检查是否是有效的配置命令
          if (
            !line.match(
              /^(tcaninit|tdiagnose_rid|tdiagnose_sid|tdiagnose_keyk|tdiagnose_dtc)\b/
            )
          ) {
            errors.push({
              line: i,
              message: "配置块中只能包含tcaninit和tdiagnose_*命令",
              severity: vscode.DiagnosticSeverity.Error,
            });
          }
        }
      }
    }

    // 警告:配置块没有通道初始化
    if (tsetLines.length > 0 && !hasChannelInit) {
      errors.push({
        line: tsetLines[0],
        message: "配置块中应该至少包含一个tcaninit语句",
        severity: vscode.DiagnosticSeverity.Warning,
      });
    }
  }

  private validateTestSuites(lines: string[], errors: ValidationError[]): void {
    // 使用栈来追踪嵌套的块结构
    interface BlockInfo {
      type: "ttitle" | "tstart" | "tset";
      line: number;
      name?: string;
    }
    const stack: BlockInfo[] = [];
    const ttitleLines: number[] = [];
    const ttitleEndLines: number[] = [];
    const tstartLines: number[] = [];
    const tendLines: number[] = [];

    // 第一遍：收集所有标记的位置并进行栈匹配
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === "tset") {
        stack.push({ type: "tset", line: i });
      } else if (line.match(/\bttitle\b=.*$/)) {
        ttitleLines.push(i);
        const name = line.substring(7).trim();
        if (!name) {
          errors.push({
            line: i,
            message: "测试用例集名称不能为空",
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        stack.push({ type: "ttitle", line: i, name });
      } else if (line === "ttitle-end") {
        ttitleEndLines.push(i);
        // 从栈顶找最近的ttitle
        let found = false;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].type === "ttitle") {
            stack.splice(j, 1);
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
      } else if (line.match(/^(?:\d+\s+)?\btstart\b/)) {
        tstartLines.push(i);
        const match = line.match(/\btstart\b(.*)$/);
        if (match && !match[1].trim()) {
          errors.push({
            line: i,
            message: "测试用例名称不能为空",
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        stack.push({ type: "tstart", line: i });
      } else if (line === "tend") {
        tendLines.push(i);
        // 从栈顶找最近的tstart或tset
        let found = false;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].type === "tstart" || stack[j].type === "tset") {
            stack.splice(j, 1);
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
    }

    // 检查栈中剩余的未配对项
    for (const block of stack) {
      if (block.type === "ttitle") {
        errors.push({
          line: block.line,
          message: `测试用例集"${block.name || ""}"缺少结束标记ttitle-end`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      } else if (block.type === "tstart") {
        errors.push({
          line: block.line,
          message: "测试用例缺少结束标记tend",
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    }
  }

  private validateCommands(
    lines: string[],
    errors: ValidationError[],
    rules: any
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("tcans ") && rules.tcans !== false) {
        this.validateTcans(line, i, errors);
      } else if (line.startsWith("tcanr ") && rules.tcanr !== false) {
        this.validateTcanr(line, i, errors);
      } else if (line.startsWith("tdelay ") && rules.tdelay !== false) {
        this.validateTdelay(line, i, errors);
      }
    }
  }

  private validateCanInit(
    line: string,
    lineNum: number,
    errors: ValidationError[]
  ): void {
    const match = line.match(/tcaninit\s+(\d+),(\d+),(\d+),(\d+)(?:,(\d+))?/);
    if (!match) {
      errors.push({
        line: lineNum,
        message:
          "tcaninit语法错误,正确格式: tcaninit 设备ID,设备索引,设备通道索引,仲裁域波特率[,数据域波特率]",
        severity: vscode.DiagnosticSeverity.Error,
      });
      return;
    }

    // 验证波特率
    const arbBaudrate = parseInt(match[4]);
    const validBaudrates = [125, 250, 500, 1000];
    if (!validBaudrates.includes(arbBaudrate)) {
      errors.push({
        line: lineNum,
        message: `仲裁域波特率${arbBaudrate}不常见,标准值为125/250/500/1000 kbps`,
        severity: vscode.DiagnosticSeverity.Warning,
      });
    }

    if (match[5]) {
      const dataBaudrate = parseInt(match[5]);
      const validDataBaudrates = [2000, 5000];
      if (!validDataBaudrates.includes(dataBaudrate)) {
        errors.push({
          line: lineNum,
          message: `CAN-FD数据域波特率${dataBaudrate}不常见,标准值为2000/5000 kbps`,
          severity: vscode.DiagnosticSeverity.Warning,
        });
      }
    }
  }

  private validateDiagnoseConfig(
    line: string,
    lineNum: number,
    errors: ValidationError[]
  ): void {
    if (
      line.startsWith("tdiagnose_rid") ||
      line.startsWith("tdiagnose_sid") ||
      line.startsWith("tdiagnose_keyk")
    ) {
      // 支持带0x或不带0x的十六进制
      if (!line.match(/(?:0x)?[0-9a-fA-F]+/)) {
        errors.push({
          line: lineNum,
          message: "诊断配置参数应该是十六进制值(可选0x前缀,例: 0x7E0 或 7E0)",
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    } else if (line.startsWith("tdiagnose_dtc")) {
      const match = line.match(/tdiagnose_dtc\s+([^,]+),(.+)/);
      if (!match) {
        errors.push({
          line: lineNum,
          message:
            "tdiagnose_dtc语法错误,正确格式: tdiagnose_dtc 故障码,故障描述",
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    }
  }

  private validateTcans(
    line: string,
    lineNum: number,
    errors: ValidationError[]
  ): void {
    // 基本格式检查
    const parts = line.substring(6).split(",");
    if (parts.length < 4) {
      errors.push({
        line: lineNum,
        message:
          "tcans参数不足,需要: [项目通道,]报文ID,报文数据,间隔(毫秒),发送次数",
        severity: vscode.DiagnosticSeverity.Error,
      });
      return;
    }

    // 检查消息ID格式 - 支持带0x或不带0x的十六进制
    const idPart = parts.length === 4 ? parts[0] : parts[1];
    if (!idPart.trim().match(/^(?:0x)?[0-9a-fA-F]+$/)) {
      errors.push({
        line: lineNum,
        message: "CAN消息ID格式错误,应为十六进制(可选0x前缀,如: 0x123 或 123)",
        severity: vscode.DiagnosticSeverity.Error,
      });
    }

    // 检查数据字节格式
    const dataPart = parts.length === 4 ? parts[1] : parts[2];
    const dataBytes = dataPart.trim().split(/[-\s]+/);
    if (dataBytes.some((b) => !b.match(/^[0-9a-fA-F]{2}$/))) {
      errors.push({
        line: lineNum,
        message:
          "数据字节格式错误,应为两位十六进制数,用-或空格分隔(例: 01-02-03)",
        severity: vscode.DiagnosticSeverity.Error,
      });
    }
  }

  private validateTcanr(
    line: string,
    lineNum: number,
    errors: ValidationError[]
  ): void {
    return; // 暂不实现任何验证逻辑
  }

  private validateTdelay(
    line: string,
    lineNum: number,
    errors: ValidationError[]
  ): void {
    const match = line.match(/tdelay\s+(\d+)/);
    if (!match) {
      errors.push({
        line: lineNum,
        message: "tdelay语法错误,正确格式: tdelay 延时毫秒数",
        severity: vscode.DiagnosticSeverity.Error,
      });
      return;
    }

    const delay = parseInt(match[1]);
    if (delay > 60000) {
      errors.push({
        line: lineNum,
        message: `延时${delay}ms过长(超过60秒),请确认是否正确`,
        severity: vscode.DiagnosticSeverity.Warning,
      });
    }
  }
}
