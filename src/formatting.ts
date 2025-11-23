import * as vscode from "vscode";

export class TesterFormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    const edits: vscode.TextEdit[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // 追踪 tset 和 tstart 块的嵌套层级 (从 0 开始)
    let indentLevel = 0;
    // 新增状态：追踪是否在 ttitle 块内
    let inTtitleBlock = false;

    const indentSize = options.insertSpaces ? options.tabSize : 4;
    const indentChar = options.insertSpaces ? " " : "\t";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 1. 空行处理：清除行内多余空格
      if (trimmedLine === "") {
        if (line.length > 0) {
          edits.push(
            vscode.TextEdit.replace(
              new vscode.Range(
                new vscode.Position(i, 0),
                new vscode.Position(i, line.length)
              ),
              ""
            )
          );
        }
        continue;
      }

      // --- A. 计算当前行应有的缩进层级 ---
      let currentBaseLevel = indentLevel;

      // 预判：如果是结束标记 (tset 或 tstart 的 tend)，本行需要先减少缩进
      if (/^tend\b/.test(trimmedLine)) {
        currentBaseLevel = Math.max(0, indentLevel - 1);
      }

      // 特殊处理：ttitle 和 ttitle-end 强制在 Level 0
      if (/^ttitle\b/.test(trimmedLine) || /^ttitle-end\b/.test(trimmedLine)) {
        // 强制设置为 0 级，满足用户“同级”的要求
        currentBaseLevel = 0;
      } else if (inTtitleBlock) {
        // 如果在 ttitle 块内 (且不是 ttitle/ttitle-end 本身)，则基础缩进+1
        // 这样能保证 tstart 从 Level 1 开始，其内容从 Level 2 开始。
        currentBaseLevel += 1;
      }

      // 2. 应用缩进
      const expectedIndent = indentChar.repeat(currentBaseLevel * indentSize);
      const currentIndentMatch = line.match(/^\s*/);
      const actualIndent = currentIndentMatch ? currentIndentMatch[0] : "";

      if (expectedIndent !== actualIndent) {
        const range = new vscode.Range(
          new vscode.Position(i, 0),
          new vscode.Position(i, actualIndent.length)
        );
        edits.push(vscode.TextEdit.replace(range, expectedIndent));
      }

      // --- B. 内容格式化 ---
      if (!trimmedLine.startsWith("//")) {
        const formattedContent = this.formatCommandLine(trimmedLine);
        if (formattedContent !== trimmedLine) {
          const contentStart = actualIndent.length;
          const range = new vscode.Range(
            new vscode.Position(i, contentStart),
            new vscode.Position(i, line.length)
          );
          edits.push(vscode.TextEdit.replace(range, formattedContent));
        }
      }

      // --- C. 状态和层级追踪 (后判) ---

      // 1. ttitle 块状态切换
      if (/^ttitle\b/.test(trimmedLine)) {
        inTtitleBlock = true;
      } else if (/^ttitle-end\b/.test(trimmedLine)) {
        inTtitleBlock = false;
      }

      // 2. 嵌套层级 (仅 tset 和 tstart 控制)
      if (
        /^tset\b/.test(trimmedLine) ||
        /^(?:\d+\s+)?tstart\b/.test(trimmedLine)
      ) {
        indentLevel++;
      } else if (/^tend\b/.test(trimmedLine)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
    }

    return edits;
  }

  /**
   * 格式化命令行内容 (保持紧凑和特定空格规则)
   */
  private formatCommandLine(line: string): string {
    const ensureCmdSpace = (str: string) => str.replace(/^(\w+)\s+/, "$1 ");
    const compactCommas = (str: string) => str.replace(/\s*,\s*/g, ",");

    // 1. ttitle (ttitle=...)
    if (/^ttitle\b/.test(line)) {
      return line.replace(/ttitle\s*=\s*/, "ttitle=");
    }

    // 2. tstart (tstart = ...)
    if (/\btstart\b/.test(line)) {
      return line.replace(/\s*=\s*/, " = ");
    }

    // 3. 紧凑逗号的命令 (tcaninit, tcans, tcanr, tdiagnose_dtc)
    if (/^(tcaninit|tcans|tcanr|tdiagnose_dtc)\b/.test(line)) {
      let formatted = ensureCmdSpace(line);
      formatted = compactCommas(formatted);
      return formatted;
    }

    // 4. 标准空格命令 (tdiagnose_rid/sid/keyk, tdelay)
    if (/^t(diagnose|delay)/.test(line)) {
      return ensureCmdSpace(line);
    }

    return line;
  }
}
