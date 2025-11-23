# Change Log

All notable changes to the "tester" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release

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