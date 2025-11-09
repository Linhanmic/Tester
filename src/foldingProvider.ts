import * as vscode from "vscode";

export class TesterFoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(
    document: vscode.TextDocument,
    context: vscode.FoldingContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    // 折叠区域的逻辑实现
    const ranges: vscode.FoldingRange[] = [];
    const lines = document.getText().split("\n");

    // 栈结构用于追踪嵌套
    interface BlockStart {
      type: "tset" | "ttitle" | "tstart";
      line: number;
      matched: boolean;
    }
    const stack: BlockStart[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // tset 块开始
      if (line === "tset") {
        stack.push({ type: "tset", line: i, matched: false });
      }
      // ttitle 块开始s
      else if (line.match(/\bttitle\b=.*$/)) {
        stack.push({ type: "ttitle", line: i, matched: false });
      }
      // tstart 块开始
      else if (line.match(/^(?:\d+\s+)?\btstart\b=.*$/)) {
        stack.push({ type: "tstart", line: i, matched: false });
      } else if (line === "tend") {
        // 从栈顶找到最近的 tset 或 tstart
        let found = false;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (
            (stack[j].type === "tset" || stack[j].type === "tstart") &&
            !stack[j].matched
          ) {
            const start = stack[j];
            // 只在行数大于1时才创建折叠区域
            if (i > start.line) {
              ranges.push(
                new vscode.FoldingRange(
                  start.line,
                  i,
                  vscode.FoldingRangeKind.Region
                )
              );
            }
            stack[j].matched = true;
            // 移除已匹配的项
            stack.splice(j, 1);
            found = true;
            break;
          }
        }
      }
      // ttitle 和 ttitle-end 块结束
      else if (line === "ttitle-end") {
        // 从栈顶找到最近的 ttitle
        let found = false;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].type === "ttitle" && !stack[j].matched) {
            const start = stack[j];
            // 只在行数大于1时才创建折叠区域
            if (i > start.line) {
              ranges.push(
                new vscode.FoldingRange(
                  start.line,
                  i,
                  vscode.FoldingRangeKind.Region
                )
              );
            }
            stack[j].matched = true;
            // 移除已匹配的项
            stack.splice(j, 1);
            found = true;
            break;
          }
        }
        // 如果没有找到匹配的 ttitle, 忽略这个ttitle-end(避免折叠异常)
      }
    }

    return ranges;
  }
}
