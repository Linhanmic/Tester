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

    // 预处理：删除//之后的注释内容，防止干扰关键字匹配
    for (let i = 0; i < lines.length; i++) {
      const commentIndex = lines[i].indexOf("//");
      if (commentIndex !== -1) {
        lines[i] = lines[i].substring(0, commentIndex).trimEnd();
      }
    }

    // 核心校验：只校验块结构的配对情况
    this.validateBlockPairing(lines, errors);

    // 转换为诊断信息
    const diagnostics: vscode.Diagnostic[] = errors.map((error) => {
      const line = document.lineAt(error.line);
      // 诊断范围定位到整行
      const range = new vscode.Range(
        error.line,
        0,
        error.line,
        line.text.length
      );

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
}
