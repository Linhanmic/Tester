import * as vscode from "vscode";

export class TesterFoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(
    document: vscode.TextDocument,
    context: vscode.FoldingContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    const ranges: vscode.FoldingRange[] = [];
    // 兼容不同操作系统的换行符
    const lines = document.getText().split(/\r?\n/);

    interface BlockStart {
      type: "tset" | "ttitle" | "tstart";
      line: number;
    }
    const stack: BlockStart[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 1. 匹配 tset (使用正则，允许后面跟空格或注释)
      // 解决：tset // comment 无法识别的问题
      if (/^tset\b/.test(line)) {
        stack.push({ type: "tset", line: i });
      }
      // 2. 匹配 ttitle (允许 = 号周围有空格)
      // 解决：ttitle = 1 (有空格) 无法识别的问题
      else if (/^ttitle\s*=/.test(line)) {
        stack.push({ type: "ttitle", line: i });
      }
      // 3. 匹配 tstart (允许前面有数字，允许 = 号周围有空格)
      // 解决：1 tstart = ... 的各种格式问题
      else if (/^(?:\d+\s+)?tstart\b/.test(line)) {
        stack.push({ type: "tstart", line: i });
      }
      // 4. 匹配 tend (tset 或 tstart 的结束)
      else if (/^tend\b/.test(line)) {
        // 从栈顶向下找最近的 tset 或 tstart
        for (let j = stack.length - 1; j >= 0; j--) {
          const item = stack[j];
          if (item.type === "tset" || item.type === "tstart") {
            // 只有行数不同才折叠（避免单行折叠）
            if (i > item.line) {
              ranges.push(
                new vscode.FoldingRange(
                  item.line,
                  i,
                  vscode.FoldingRangeKind.Region
                )
              );
            }
            // 【关键修改】找到匹配项后，移除它以及它上面所有的内容
            // 这能处理用户忘记写 tend 的情况，防止栈污染
            stack.splice(j, stack.length - j);
            break;
          }
        }
      }
      // 5. 匹配 ttitle-end (ttitle 的结束)
      else if (/^ttitle-end\b/.test(line)) {
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].type === "ttitle") {
            if (i > stack[j].line) {
              ranges.push(
                new vscode.FoldingRange(
                  stack[j].line,
                  i,
                  vscode.FoldingRangeKind.Region
                )
              );
            }
            // 【关键修改】ttitle 结束时，强制关闭内部所有未闭合的 tstart
            stack.splice(j, stack.length - j);
            break;
          }
        }
      }
    }

    return ranges;
  }
}
