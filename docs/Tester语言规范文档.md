# Tester语言规范文档

**版本**: 1.0.0
 **日期**: 2025--10–20
 **状态**: 正式版

## 1. 语言概述

### 1.1 简介

Tester是一种专门用于汽车CAN/CAN-FD总线测试的领域特定语言（DSL）。该语言提供了设备配置、诊断信息配置、测试用例编写等功能，支持自动化测试流程的定义与执行。

### 1.2 设计原则

- **简洁性**: 采用简洁直观的语法结构
- **可读性**: 命令和参数具有明确的语义
- **模块化**: 支持配置块与测试用例的分离组织
- **抽象性**: 通过项目通道概念屏蔽底层硬件复杂性
- **扩展性**: 便于添加新的测试命令和功能

### 1.3 核心概念

- **项目通道**: 测试层面的逻辑通道抽象，与物理设备通道解耦
- **设备通道**: 实际硬件CAN/CAN-FD通道
- **通道映射**: 通过配置建立项目通道到设备通道的映射关系

### 1.4 文件扩展名

- 推荐使用 `.tester` 作为源文件扩展名

## 2. 词法结构

### 2.1 字符集

- 支持ASCII字符集
- 支持UTF-8编码的中文字符（用于注释和字符串描述）

### 2.2 词法元素

#### 2.2.1 关键字

```
tset        tend        ttitle      ttitle-end
tstart      tcaninit    tcans       tcanr
tdelay      tdiagnose_rid           tdiagnose_sid
tdiagnose_keyk         tdiagnose_dtc
print
```

#### 2.2.2 标识符

- 由字母、数字、下划线组成
- 必须以字母或下划线开头
- 区分大小写

#### 2.2.3 字面量

- **整数**: 十进制数字，如 `100`, `500`
- **十六进制**: `0x` 前缀，如 `0x7E8`, `0x18DA00F1`
- **字符串**: 不带引号的文本序列，用于描述信息
- **位范围**: `byte.bit` 格式，如 `2.3` 表示第2字节第3位

#### 2.2.4 分隔符

- **逗号** (`,`): 参数分隔
- **破折号** (`-`): 字节数据分隔、位范围表示
- **点号** (`.`): 位范围中字节与位的分隔符
- **加号** (`+`): 多段数据连接
- **方括号** (`[]`): 可选参数标记
- **等号** (`=`): 赋值操作

#### 2.2.5 注释

```tester
// 单行注释，从 // 开始到行末
```

### 2.3 空白字符

- 空格、制表符、换行符作为词法单元分隔符
- 在语法结构中，适当的缩进提高可读性（非强制）

## 3. 语法结构

### 3.1 程序结构

一个完整的Tester程序由以下部分组成：

```ebnf
program ::= [configuration_block] test_suite_list

configuration_block ::= "tset" configuration_items "tend"

test_suite_list ::= test_suite+

test_suite ::= "ttitle=" suite_name test_case_list "ttitle-end"
```

**重要约束**：

- 每个项目文件最多包含一个配置块
- 配置块中可以定义多个项目通道（通过多个`tcaninit`语句）
- 配置块必须出现在所有测试用例集之前

### 3.2 配置块语法

#### 3.2.1 配置块结构

```tester
tset
  configuration_items
tend
```

**语法定义**：

```ebnf
configuration_block ::= "tset" NEWLINE configuration_items "tend" NEWLINE

configuration_items ::= (channel_init | diagnose_config | dtc_config | comment)*
```

**关键特性**：

- **唯一性**: 每个项目文件仅允许定义一个配置块
- **多通道支持**: 配置块内可通过多条`tcaninit`语句配置多个项目通道
- **位置要求**: 配置块必须位于文件开始处，在所有测试用例集之前

#### 3.2.2 项目通道初始化配置

**概念说明**：

- **设备通道**：物理CAN设备上的实际通道，由设备ID、设备索引和通道索引唯一确定
- **项目通道**：测试项目中的逻辑通道，用于简化测试命令中的通道引用
- **映射关系**：通过`tcaninit`语句建立项目通道到设备通道的映射

**语法**：

```tester
tcaninit device_id,device_index,channel_index,arbitration_baudrate[,data_baudrate]
```

**功能描述**： 该命令将一个物理设备通道映射为项目通道，并完成通道初始化配置。每条`tcaninit`语句创建一个新的项目通道。

**参数说明**：

| 参数                 | 类型 | 必选 | 描述                                       |
| -------------------- | ---- | ---- | ------------------------------------------ |
| device_id            | 整数 | 是   | 物理设备标识符                             |
| device_index         | 整数 | 是   | 物理设备索引号（当有多个相同ID设备时区分） |
| channel_index        | 整数 | 是   | 物理设备上的通道索引（设备通道）           |
| arbitration_baudrate | 整数 | 是   | 仲裁域波特率（单位：kbps）                 |
| data_baudrate        | 整数 | 否   | 数据域波特率（CAN-FD专用，单位：kbps）     |

**示例**：

```tester
tcaninit 1,0,0,500        // 将设备1的通道0初始化为项目通道0（500kbps）
tcaninit 2,0,1,500,2000   // 将设备2的通道1初始化为项目通道1（CAN-FD）
```

**项目通道分配规则**：

1. **自动分配**：项目通道索引根据`tcaninit`语句的出现顺序自动分配
2. **从零开始**：第一条`tcaninit`语句创建项目通道0，第二条创建项目通道1，依此类推
3. **连续递增**：项目通道索引始终连续，不受设备通道索引影响

**项目通道 vs 设备通道**：

```tester
tset
  tcaninit 1,0,3,500      // 设备1的通道3 → 项目通道0
  tcaninit 2,1,0,250      // 设备2的通道0 → 项目通道1
  tcaninit 1,0,5,500,2000 // 设备1的通道5 → 项目通道2
tend

// 在测试命令中使用项目通道索引：
tcans 0,0x123,01-02,100,1   // 使用项目通道0（实际发送到设备1的通道3）
tcans 1,0x456,AA-BB,50,1    // 使用项目通道1（实际发送到设备2的通道0）
tcans 2,0x789,11-22,200,1   // 使用项目通道2（实际发送到设备1的通道5）
注意：tcans中由于报文ID都是16进制，为了方便可以省略0x前缀
```

**重要提示**：

- 测试命令中始终使用项目通道索引（0, 1, 2...），而非设备通道索引
- 项目通道提供了设备无关的抽象层，简化了测试用例的编写和移植

#### 3.2.3 诊断信息配置

**语法**：

```tester
tdiagnose_rid request_id
tdiagnose_sid response_id
tdiagnose_keyk security_key
```

**参数说明**：

| 命令           | 参数类型 | 描述           |
| -------------- | -------- | -------------- |
| tdiagnose_rid  | 十六进制 | 诊断请求报文ID |
| tdiagnose_sid  | 十六进制 | 诊断响应报文ID |
| tdiagnose_keyk | 十六进制 | 安全访问密钥值 |

**示例**：

```tester
tdiagnose_rid 0x7E0
tdiagnose_sid 0x7E8
tdiagnose_keyk 0x12345678
注意：十六进制数值的0x前缀，可以省略
```

**约束**：

- 诊断配置必须成套出现（请求ID、响应ID、密钥）
- 每个项目仅支持一套诊断配置

#### 3.2.4 故障码配置

**语法**：

```tester
tdiagnose_dtc fault_code,fault_description
```

**参数说明**：

| 参数              | 类型            | 描述         |
| ----------------- | --------------- | ------------ |
| fault_code        | 十六进制/字符串 | 故障码值     |
| fault_description | 字符串          | 故障描述文本 |

**示例**：

```tester
tdiagnose_dtc P0001,燃油量调节器控制电路/开路
tdiagnose_dtc P0002,燃油量调节器控制电路范围/性能
tdiagnose_dtc 0xC1234,ABS模块通信故障
注意：十六进制数值的0x前缀，可以省略
```

### 3.3 测试用例语法

#### 3.3.1 测试用例集结构

**语法**：

```tester
ttitle=test_suite_name
  test_case_list
ttitle-end
```

**语法定义**：

```ebnf
test_suite ::= "ttitle=" suite_name NEWLINE test_case_list "ttitle-end" NEWLINE

test_case_list ::= test_case+

suite_name ::= string_literal
```

#### 3.3.2 测试用例结构

**语法**：

```tester
[sequence_number] tstart=test_case_name
  command_list
tend
```

**语法定义**：

```ebnf
test_case ::= [integer] "tstart=" case_name NEWLINE command_list "tend" NEWLINE

command_list ::= (test_command | comment)*

case_name ::= string_literal
```

**参数说明**：

- `sequence_number`: 可选的测试用例序号，用于标识和排序
- `test_case_name`: 测试用例名称描述

### 3.4 测试命令语法

#### 3.4.1 报文发送命令（tcans）

**语法**：

```tester
tcans [channel_index,]message_id,data_bytes,interval_ms,repeat_count
```

**参数说明**：

| 参数          | 类型         | 必选 | 描述                                                  |
| ------------- | ------------ | ---- | ----------------------------------------------------- |
| channel_index | 整数         | 否   | 项目通道索引（默认0），注意：这是项目通道而非设备通道 |
| message_id    | 十六进制     | 是   | CAN/CAN-FD报文ID                                      |
| data_bytes    | 十六进制序列 | 是   | 报文数据，字节间用`-`或空格分隔                       |
| interval_ms   | 整数         | 是   | 发送间隔（毫秒）                                      |
| repeat_count  | 整数         | 是   | 发送次数                                              |

**数据格式**：

- 标准CAN: 最多8字节
- CAN-FD: 最多64字节
- 字节表示: `XX-XX-XX` 或 `XX XX XX`（XX为两位十六进制数）

**示例**：

```tester
tcans 0x123,01-02-03-04-05-06-07-08,100,5     // 项目通道0发送5次（省略通道参数）
tcans 1,0x456,AA-BB-CC-DD,50,10               // 指定项目通道1发送10次
注意：十六进制数值的0x前缀，可以省略
```

**注意**：通道参数指的是项目通道索引，不是设备通道索引

#### 3.4.2 报文校验命令（tcanr）

**语法格式1 - 数据校验**：

```tester
tcanr [channel_index,]message_id,bit_range[+bit_range...],expected_value[+expected_value...],timeout_ms
```

**语法格式2 - 数据输出**：

```tester
tcanr [channel_index,]message_id,bit_range,print
```

**参数说明**：

| 参数           | 类型     | 描述                                                         |
| -------------- | -------- | ------------------------------------------------------------ |
| channel_index  | 整数     | 项目通道索引（可选，默认0），注意：这是项目通道而非设备通道  |
| message_id     | 十六进制 | 待接收的报文ID                                               |
| bit_range      | 位范围   | 格式：`byte.bit-byte.bit`，如`2.1-3.5`表示第2字节第1位到第3字节第5位 |
| expected_value | 十六进制 | 期望值                                                       |
| timeout_ms     | 整数     | 超时等待时间（毫秒）                                         |
| print          | 关键字   | 输出接收值而非校验                                           |

**位范围说明**：

- **格式**：`byte.bit-byte.bit`，其中byte为字节索引（从0开始），bit为位索引（0-7）
- **字节索引**：从0开始计数，第一个字节为0，第二个字节为1，依此类推
- **位索引**：每个字节内的位从0到7，其中bit0为最低位(LSB)，bit7为最高位(MSB)
- **多段范围**：支持用`+`连接多个不连续的位范围
- **位序**：采用小端序（Little-Endian），即低位在前

**示例**：

```tester
// 校验单个字节（第2字节的全部8位）
tcanr 0x7E8,1.0-1.7,0x50,1000

// 校验跨字节的位段（第0字节第4位到第1字节第3位）
tcanr 0x123,0.4-1.3,0x0F,500

// 校验多个不连续位段
tcanr 0x456,1.2-1.5+3.0-3.7,0x0C+0xFF,500

// 输出第2-3字节的值
tcanr 1,0x789,2.0-3.7,print
注意：报文ID的十六进制数值的0x前缀可以省略，但是期待值如果是16进制必须加上0x前缀，否则认为是十进制数
```

**位范围计算示例**：

```
报文数据: [0xAA, 0xBB, 0xCC, 0xDD]
字节索引:   0     1     2     3

范围 0.0-0.7 = 0xAA (整个第0字节)
范围 1.4-1.7 = 0x0B (0xBB的高4位)
范围 1.0-2.3 = 0xCCB (跨第1和第2字节的12位)
```

#### 3.4.3 延时命令（tdelay）

**语法**：

```tester
tdelay delay_ms
```

**参数说明**：

- `delay_ms`: 延时时间（毫秒）

**示例**：

```tester
tdelay 1000  // 延时1秒
```

## 4. 执行语义

### 4.1 执行顺序

1. **配置阶段**: 解析并执行唯一的配置块中的所有配置项
2. **测试阶段**: 按顺序执行各测试用例集
3. **用例执行**: 测试用例内的命令按出现顺序串行执行

**配置块约束**：

- 每个项目文件只能包含一个`tset...tend`配置块
- 如果存在多个配置块，将产生语法错误
- 配置块可选，但如果存在必须位于文件最前面

### 4.2 项目通道与设备通道映射机制

#### 4.2.1 核心概念

- **设备通道**：物理CAN设备的实际硬件通道，由设备ID、设备索引和通道索引三元组确定
- **项目通道**：测试项目中的逻辑通道抽象，提供统一的通道访问接口
- **映射关系**：`tcaninit`语句建立从项目通道到设备通道的映射

#### 4.2.2 映射规则

1. **顺序分配**：项目通道索引按`tcaninit`语句出现顺序自动分配
2. **从零递增**：第一个`tcaninit`创建项目通道0，第二个创建项目通道1，以此类推
3. **全局唯一**：项目通道索引在整个项目中唯一且连续

#### 4.2.3 使用原则

- **配置阶段**：使用设备通道参数（在`tcaninit`中指定物理通道）
- **测试阶段**：使用项目通道索引（在测试命令中引用逻辑通道）
- **抽象优势**：项目通道屏蔽了底层硬件差异，提高测试用例的可移植性

#### 4.2.4 映射示例

```tester
tset
  // 映射关系建立：
  tcaninit 1,0,2,500      // 设备1-索引0-通道2 → 项目通道0
  tcaninit 1,1,0,250      // 设备1-索引1-通道0 → 项目通道1
  tcaninit 2,0,1,500,2000 // 设备2-索引0-通道1 → 项目通道2
tend

ttitle=通道映射测试
  1 tstart=使用项目通道进行测试
    // 所有测试命令使用项目通道索引
    tcans 0,0x123,01-02-03,100,1      // 通过项目通道0发送（映射到设备1-索引0-通道2）
    tcans 1,0x456,AA-BB,50,1          // 通过项目通道1发送（映射到设备1-索引1-通道0）
    tcanr 2,0x789,0.0-0.7,0xFF,1000   // 通过项目通道2接收第0字节（映射到设备2-索引0-通道1）
  tend
ttitle-end
```

**关键要点**：测试人员只需关注项目通道索引（0,1,2...），无需了解底层设备通道配置细节

### 4.3 错误处理

#### 4.3.1 语法错误

- 未识别的关键字
- 参数数量不匹配
- 参数类型错误
- 缺少必需的配置项

#### 4.3.2 运行时错误

- 设备初始化失败
- 报文发送失败
- 接收超时
- 数据校验失败

### 4.4 超时机制

- `tcanr`命令支持超时设置
- 超时后返回错误，继续执行后续命令
- 超时不会导致整个测试终止

## 5. 完整示例

```tester
// 设备配置块
tset
  // 项目通道初始化配置
  // 每条tcaninit创建一个项目通道，按顺序自动编号0,1,2...
  tcaninit 1,0,0,500          // 创建项目通道0：映射到设备1的通道0，500kbps
  tcaninit 1,0,1,500,2000     // 创建项目通道1：映射到设备1的通道1，CAN-FD模式
  
  // 诊断配置
  tdiagnose_rid 0x7E0
  tdiagnose_sid 0x7E8
  tdiagnose_keyk 0x87654321
  
  // 故障码定义
  tdiagnose_dtc P0171,系统过稀（第1排）
  tdiagnose_dtc P0172,系统过浓（第1排）
  tdiagnose_dtc P0300,检测到失火
tend

// 功能测试用例集
ttitle=ECU功能测试
  1 tstart=诊断会话建立
    // 使用项目通道0发送诊断请求（省略通道参数时默认使用项目通道0）
    tcans 0x7E0,02-10-03-00-00-00-00-00,0,1
    tcanr 0x7E8,1.0-1.7,0x50,1000  // 校验第1字节（响应码）
    tdelay 100
  tend
  
  2 tstart=读取故障码
    tcans 0x7E0,02-19-02-FF-00-00-00-00,0,1
    tcanr 0x7E8,1.0-1.7,0x59,2000  // 校验第1字节（肯定响应）
    tcanr 0x7E8,3.0-5.7,print      // 输出第3-5字节的故障码
  tend
  
  3 tstart=清除故障码
    tcans 0x7E0,04-14-FF-FF-FF-00-00-00,0,1
    tcanr 0x7E8,1.0-1.7,0x54,1000  // 校验第1字节（清除确认）
    tdelay 500
  tend
ttitle-end

// 性能测试用例集
ttitle=CAN总线负载测试
  1 tstart=高频报文发送测试
    // 明确指定项目通道索引进行并发测试
    tcans 0,0x100,11-22-33-44-55-66-77-88,10,100  // 项目通道0发送100个报文
    tcans 1,0x200,AA-BB-CC-DD,10,100              // 项目通道1并发发送
    tdelay 1000
  tend
  
  2 tstart=报文接收验证
    // 从不同项目通道接收和验证报文
    tcanr 0,0x300,0.0-7.7,print                   // 项目通道0接收8字节并输出
    tcanr 1,0x400,0.0-3.7,0xDEADBEEF,500         // 项目通道1接收4字节并校验
  tend
ttitle-end
```

## 6. 编码规范建议

### 6.1 命名约定

- 测试用例集名称使用描述性中文或英文
- 测试用例名称简洁明确，说明测试目的
- 使用有意义的注释说明复杂逻辑

### 6.2 格式化建议

- 配置块和测试用例块适当缩进
- 相关配置项分组放置
- 每个测试用例间留空行提高可读性

### 6.3 最佳实践

- 将通用配置放在配置块开始处
- 按功能模块组织测试用例集
- 合理设置超时时间，避免测试阻塞
- 使用注释记录测试预期和注意事项

## 7. 语言扩展性

### 7.1 保留关键字

以下前缀保留用于未来扩展：

- `t_`: 通用测试命令
- `tcan_`: CAN相关命令
- `tdiag_`: 诊断相关命令
- `teth_`: 以太网相关命令

### 7.2 版本兼容性

- 向后兼容：新版本支持旧版本语法
- 废弃通知：计划废弃的特性提前两个版本通知
- 迁移指南：重大变更提供详细迁移文档

## 附录A：EBNF语法定义

```ebnf
// 基本元素
digit           ::= "0" | "1" | ... | "9"
hex_digit       ::= digit | "A" | ... | "F" | "a" | ... | "f"
letter          ::= "A" | ... | "Z" | "a" | ... | "z"
underscore      ::= "_"

// 字面量
integer         ::= digit+
hex_integer     ::= "0x" hex_digit+
identifier      ::= (letter | underscore) (letter | digit | underscore)*
string_literal  ::= (任意非换行字符)+

// 注释
comment         ::= "//" (任意非换行字符)* NEWLINE

// 数据格式
byte_data       ::= hex_digit hex_digit
data_sequence   ::= byte_data (("-" | " ") byte_data)*
bit_position    ::= integer "." integer
bit_range       ::= bit_position "-" bit_position
bit_ranges      ::= bit_range ("+" bit_range)*
values          ::= (hex_integer | integer) ("+" (hex_integer | integer))*

// 配置命令
channel_init    ::= "tcaninit" integer "," integer "," integer "," integer ["," integer] NEWLINE
diagnose_rid    ::= "tdiagnose_rid" hex_integer NEWLINE
diagnose_sid    ::= "tdiagnose_sid" hex_integer NEWLINE
diagnose_keyk   ::= "tdiagnose_keyk" hex_integer NEWLINE
dtc_config      ::= "tdiagnose_dtc" (hex_integer | identifier) "," string_literal NEWLINE

// 测试命令
tcans_command   ::= "tcans" [integer ","] hex_integer "," data_sequence "," integer "," integer NEWLINE
tcanr_command   ::= "tcanr" [integer ","] hex_integer "," bit_ranges "," (values | "print") "," integer NEWLINE
tdelay_command  ::= "tdelay" integer NEWLINE

// 结构定义
configuration_block ::= "tset" NEWLINE (channel_init | diagnose_rid | diagnose_sid | 
                        diagnose_keyk | dtc_config | comment)* "tend" NEWLINE

test_command    ::= tcans_command | tcanr_command | tdelay_command
test_case       ::= [integer] "tstart=" string_literal NEWLINE 
                    (test_command | comment)* "tend" NEWLINE
test_suite      ::= "ttitle=" string_literal NEWLINE test_case+ "ttitle-end" NEWLINE

// 程序
program         ::= [configuration_block] test_suite+
```

## 附录B：错误代码表

| 错误代码 | 类别       | 描述                 |
| -------- | ---------- | -------------------- |
| E001     | 语法错误   | 未识别的关键字       |
| E002     | 语法错误   | 参数数量不匹配       |
| E003     | 语法错误   | 参数类型错误         |
| E004     | 语法错误   | 缺少必需的结束标记   |
| E005     | 语法错误   | 重复的配置项         |
| E006     | 语法错误   | 项目中存在多个配置块 |
| R001     | 运行时错误 | 设备初始化失败       |
| R002     | 运行时错误 | 通道索引越界         |
| R003     | 运行时错误 | 报文发送失败         |
| R004     | 运行时错误 | 接收超时             |
| R005     | 运行时错误 | 数据校验失败         |
| W001     | 警告       | 未使用的配置项       |
| W002     | 警告       | 超长的报文数据       |

## 附录C：标准波特率表

| 波特率(kbps) | 应用场景             |
| ------------ | -------------------- |
| 125          | 低速CAN              |
| 250          | 中速CAN              |
| 500          | 高速CAN（常用）      |
| 1000         | 高速CAN              |
| 2000         | CAN-FD数据域         |
| 5000         | CAN-FD数据域（高速） |

## 附录D：位索引系统说明

### D.1 位索引格式

- **基本格式**：`byte.bit`
- **字节索引**：从0开始的整数，表示报文中的字节位置
- **位索引**：0-7的整数，表示字节内的位位置

### D.2 位序定义

```
字节内位序（LSB First）：
  Bit:  7  6  5  4  3  2  1  0
  权重: 128 64 32 16 8  4  2  1
        MSB              LSB
```

### D.3 位范围示例

```
CAN报文: [0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0]
字节索引:  0     1     2     3     4     5     6     7

常用位范围示例：
- 0.0-0.7  : 第0字节全部8位 = 0x12
- 1.4-1.7  : 第1字节高4位 = 0x3
- 1.0-1.3  : 第1字节低4位 = 0x4
- 0.4-2.3  : 跨3字节共16位 = 0x2345的低12位
- 2.2-2.5  : 第2字节的第2-5位 = 0x5的第2-5位
```

### D.4 多段位范围

```
使用 + 连接多个位范围：
tcanr 0x123,0.0-0.3+2.4-2.7,0x02+0x05,1000

表示同时校验：
- 第0字节的低4位（期望值0x02）
- 第2字节的高4位（期望值0x05）
```

------

**文档修订历史**

| 版本  | 日期        | 作者      | 修订内容                                 |
| ----- | ----------- | --------- | ---------------------------------------- |
| 1.0.0 | 2025--10-20 | Linhanmic | 初始版本发布                             |
| 1.0.1 | 2025-11-24  | Linhanmic | 添加部分命令中十六进制数省略0x前缀的说明 |

**待修订问题**

| 序号 |      | 日期 | 提出者 | 问题内容 |
| ---- | ---- | ---- | ------ | -------- |
|      |      |      |        |          |
|      |      |      |        |          |
|      |      |      |        |          |

