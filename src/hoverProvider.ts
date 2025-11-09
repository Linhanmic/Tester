import * as vscode from 'vscode';

export class TesterHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return null;
        }

        const word = document.getText(range);
        const hoverInfo = this.getHoverInfo(word, document, position);

        if (hoverInfo) {
            return new vscode.Hover(hoverInfo);
        }

        return null;
    }

    private getHoverInfo(word: string, document: vscode.TextDocument, position: vscode.Position): vscode.MarkdownString | null {
        // 命令关键字说明
        const commandDocs: { [key: string]: string } = {
            'tset': '**配置块开始**\n\n标记配置块的开始,包含通道初始化和诊断配置等。\n\n每个项目文件只能有一个配置块,且必须位于所有测试用例之前。',
            
            'tend': '**配置块/测试用例结束**\n\n标记配置块或测试用例的结束。',
            
            'ttitle': '**测试用例集开始**\n\n语法: `ttitle=测试用例集名称`\n\n定义一个测试用例集,包含多个相关的测试用例。',
            
            'ttitle-end': '**测试用例集结束**\n\n标记测试用例集的结束。',
            
            'tstart': '**测试用例开始**\n\n语法: `[序号] tstart=测试用例名称`\n\n定义一个测试用例,序号可选。',
            
            'tcaninit': '**通道初始化**\n\n语法: `tcaninit device_id,device_index,channel_index,arbitration_baudrate[,data_baudrate]`\n\n' +
                '将物理设备通道映射为项目通道。\n\n' +
                '**参数**:\n' +
                '- device_id: 设备标识符\n' +
                '- device_index: 设备索引\n' +
                '- channel_index: 物理通道索引\n' +
                '- arbitration_baudrate: 仲裁域波特率(kbps)\n' +
                '- data_baudrate: 数据域波特率(可选,CAN-FD)\n\n' +
                '**示例**:\n```tester\ntcaninit 1,0,0,500        // CAN\ntcaninit 2,0,1,500,2000   // CAN-FD\n```\n\n' +
                '**重要**: 项目通道索引按tcaninit出现顺序自动分配(0,1,2...)',
            
            'tdiagnose_rid': '**诊断请求报文ID**\n\n语法: `tdiagnose_rid 十六进制ID`\n\n' +
                '配置诊断请求报文的CAN ID(可选0x前缀)。\n\n' +
                '**示例**: `tdiagnose_rid 0x7E0` 或 `tdiagnose_rid 7E0`',
            
            'tdiagnose_sid': '**诊断响应报文ID**\n\n语法: `tdiagnose_sid 十六进制ID`\n\n' +
                '配置诊断响应报文的CAN ID(可选0x前缀)。\n\n' +
                '**示例**: `tdiagnose_sid 0x7E8` 或 `tdiagnose_sid 7E8`',
            
            'tdiagnose_keyk': '**安全访问密钥**\n\n语法: `tdiagnose_keyk 十六进制密钥值`\n\n' +
                '配置安全访问所需的密钥(可选0x前缀)。\n\n' +
                '**示例**: `tdiagnose_keyk 0x12345678` 或 `tdiagnose_keyk 12345678`',
            
            'tdiagnose_dtc': '**故障码配置**\n\n语法: `tdiagnose_dtc 故障码,故障描述`\n\n' +
                '定义故障码及其描述。\n\n' +
                '**示例**:\n```tester\ntdiagnose_dtc P0001,燃油量调节器控制电路\ntdiagnose_dtc 0xC1234,ABS模块通信故障\n```',
            
            'tcans': '**发送CAN报文**\n\n语法: `tcans [channel_index,]message_id,data_bytes,interval_ms,repeat_count`\n\n' +
                '**参数**:\n' +
                '- channel_index: 项目通道索引(可选,默认0)\n' +
                '- message_id: CAN报文ID(十六进制,可选0x前缀)\n' +
                '- data_bytes: 报文数据(字节用-分隔)\n' +
                '- interval_ms: 发送间隔(毫秒)\n' +
                '- repeat_count: 发送次数\n\n' +
                '**示例**:\n```tester\ntcans 0x123,01-02-03-04,100,5\ntcans 123,01-02-03-04,100,5\ntcans 1,0x456,AA-BB-CC,50,10\n```\n\n' +
                '**注意**: channel_index是项目通道索引,不是设备通道索引',
            
            'tcanr': '**接收并校验CAN报文**\n\n语法: `tcanr [channel_index,]message_id,bit_range,expected_value,timeout_ms`\n\n' +
                '或: `tcanr [channel_index,]message_id,bit_range,print`\n\n' +
                '**位范围格式**: `byte.bit-byte.bit`\n' +
                '- byte: 字节索引(从0开始)\n' +
                '- bit: 位索引(0-7, bit0=LSB, bit7=MSB)\n\n' +
                '**示例**:\n```tester\ntcanr 0,0x7E8,1.0-1.7,0x50,1000  // 校验第1字节\ntcanr 0,0x7E8,2.0-3.7,print      // 输出第2-3字节\ntcanr 0,0x123,0.4-1.3,0x0F,500   // 跨字节校验\n```\n\n' +
                '**多段范围**: 用+连接, 如`1.2-1.5+3.0-3.7`',
            
            'tdelay': '**延时**\n\n语法: `tdelay delay_ms`\n\n' +
                '暂停执行指定时间。\n\n' +
                '**参数**: delay_ms - 延时时间(毫秒)\n\n' +
                '**示例**: `tdelay 1000  // 延时1秒`',
            
            'print': '**输出数据**\n\n用于tcanr命令,输出接收到的数据而非校验。\n\n' +
                '**示例**: `tcanr 0,0x7E8,2.0-3.7,print`'
        };

        if (word in commandDocs) {
            return new vscode.MarkdownString(commandDocs[word]);
        }

        // 波特率说明
        if (word.match(/^\d+$/) && this.isInBaudrateContext(document, position)) {
            const baudrate = parseInt(word);
            if ([125, 250, 500, 1000, 2000, 5000].includes(baudrate)) {
                const descriptions: { [key: number]: string } = {
                    125: '低速CAN',
                    250: '中速CAN',
                    500: '高速CAN(常用)',
                    1000: '高速CAN',
                    2000: 'CAN-FD数据域',
                    5000: 'CAN-FD数据域(高速)'
                };
                return new vscode.MarkdownString(
                    `**波特率**: ${baudrate} kbps\n\n应用场景: ${descriptions[baudrate]}`
                );
            }
        }

        // 十六进制数说明
        if (word.match(/^0x[0-9a-fA-F]+$/)) {
            const value = parseInt(word, 16);
            return new vscode.MarkdownString(
                `**十六进制值**: ${word}\n\n十进制: ${value}\n\n二进制: ${value.toString(2).padStart(8, '0')}`
            );
        }

        // 位范围说明
        if (word.match(/^\d+\.\d+$/)) {
            const [byte, bit] = word.split('.').map(Number);
            if (bit >= 0 && bit <= 7) {
                return new vscode.MarkdownString(
                    `**位位置**: 第${byte}字节的第${bit}位\n\n` +
                    `字节索引从0开始,位索引0-7(LSB到MSB)`
                );
            }
        }

        return null;
    }

    private isInBaudrateContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        const line = document.lineAt(position.line).text;
        return line.includes('tcaninit');
    }
}
