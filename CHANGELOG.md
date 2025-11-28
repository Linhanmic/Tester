# Change Log

All notable changes to the "tester" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [v0.0.6] - 2025-11-28

### Added

#### 代码补全和智能提示
- **位域函数名补全**：输入时自动提示可用的位域函数，并生成参数模板
- **枚举值补全**：在函数调用时，自动提示可用的枚举值
- **参数名补全**：智能提示函数参数名称
- **关键字补全**：tenum、tbitfield、tconfirm关键字自动补全

#### 语法高亮增强
- **tenum关键字**：枚举定义高亮显示
- **tbitfield关键字**：位域函数定义高亮显示
- **tconfirm关键字**：用户确认命令高亮显示
- **枚举值**：枚举值和数值映射高亮
- **位域映射**：位域范围、缩放因子高亮
- **函数调用**：位域函数调用语法高亮

#### 代码片段模板
- **tenum片段**：快速插入枚举定义
- **tbitfield片段**：单CAN报文位域函数模板
- **tbitfield-multi片段**：多CAN报文位域函数模板
- **tconfirm片段**：用户确认命令模板
- **tbitfield-speed片段**：车速信号完整示例
- **tbitfield-gear片段**：档位信号完整示例

### Technical Details
- `src/completionProvider.ts`: 新增代码补全提供程序
- `syntaxes/tester.tmLanguage.json`: 新增位域语法高亮规则
- `snippets/tester.json`: 新增7个代码片段

### Improved Developer Experience
- 🎯 智能提示减少输入错误
- ⚡ 代码片段提升编写速度
- 🎨 语法高亮增强代码可读性
- 📝 完整示例片段加速学习

## [v0.0.5] - 2025-11-28

### Added

#### 位域函数语法 (Bitfield Function Syntax)
- **枚举定义 (`tenum`)**：支持定义可重用的枚举类型，用于CAN信号值映射
- **位域函数定义 (`tbitfield`)**：将CAN报文的多个信号位封装为参数化函数
  - 支持数值类型参数和缩放因子（如 `/100` 表示精度0.01）
  - 支持枚举类型参数
  - 自动处理Intel字节序的位域编码
- **多CAN报文支持**：一个位域函数可以同时定义多个CAN报文映射
  - 使用分号(;)分隔不同的CAN报文
  - 一次函数调用自动发送所有定义的CAN报文
- **位域函数调用**：使用自然语义调用函数（如 `车速 车速值=100, 车速单位=km/h`）

#### 脚本转换功能
- **转换命令**：通过命令面板 "Tester: 转换为原始指令脚本" 将位域函数语法转换为tcans指令
- **文档化输出**：转换后保留枚举和函数定义的注释说明
- **多报文展开**：自动将多CAN报文函数调用展开为多条tcans命令
- **兼容性**：转换后的脚本可在旧版Tester中直接运行

#### 示例和文档
- 新增 `BITFIELD_SYNTAX.md` - 位域函数语法完整文档
- 新增 `bitfield_example.tester` - 位域函数基础示例
- 新增 `examples/vehicle_control.tester` - 车辆控制系统综合测试示例（16个测试用例）

### Changed
- 更新主 README.md，添加完整的功能说明和快速开始指南
- 改进代码结构，支持更灵活的CAN信号定义方式

### Technical Details
- `src/parser.ts`: 新增 `BitFieldFunction`, `BitFieldMessageMapping` 等接口，支持位域函数解析
- `src/executor.ts`: 实现位域函数调用执行，自动生成和发送CAN报文
- `src/converter.ts`: 实现脚本转换器，支持位域函数语法到tcans指令的转换
- `test/bitfield.test.ts`: 14个单元测试覆盖位域函数语法（全部通过）
- `test/converter.test.ts`: 13个单元测试覆盖脚本转换功能（全部通过）

## [v0.0.4] - 2025-11-23

### Added
- CANFD send and receive support with fixes for test failures
- setValue and getValue methods for device property configuration
- ZLGCAN secondary development library files and usage manual
- Dual-channel send/receive verification in test code
- Code perspective functionality
- ZLGCAN device code and test implementation
- Native module build and test scripts to package.json

### Changed
- Updated device type constants according to zlgcan.h definitions
- Improved native module build and copy process
- Configured Node native module output to lib directory with encapsulated calls

### Fixed
- Compilation errors by adding typedef.h file from ZLGCAN secondary development library
- Native module build and copy flow issues
- Test failures related to CANFD functionality

### Build & Infrastructure
- Added packaging commands and updated version to 0.0.4
- Added TODO file for tracking future tasks
- Configured build directory to be ignored, with project root set to current top-level directory
- Added zlgcan.node file to support CAN communication