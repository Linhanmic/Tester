# Release Log - v0.0.4

## Release Date: November 23, 2025

### Summary
This release introduces significant improvements to the CAN communication functionality, including CANFD support, device property configuration, and enhanced testing capabilities. The release also includes improvements to the native module build process and various bug fixes.

### New Features
- **CANFD Support**: Added CANFD send and receive support with fixes for test failures
- **Device Property Configuration**: Added setValue and getValue methods for device property configuration
- **ZLGCAN Integration**: Added ZLGCAN secondary development library files and usage manual
- **Dual Channel Testing**: Improved test code to support dual-channel send/receive verification
- **Native Module Integration**: Configured Node native module output to lib directory with encapsulated calls
- **Code Perspective Feature**: Implemented code perspective functionality

### Enhancements
- Updated device type constants according to zlgcan.h definitions
- Improved native module build and copy process
- Updated package.json with native module build and test scripts
- Added ZLGCAN device test code
- Added ZLGCAN device code implementation

### Bug Fixes
- Fixed compilation errors by adding typedef.h file from zlgcan secondary development library
- Resolved native module build and copy flow issues
- Fixed test failures related to CANFD functionality

### Build & Infrastructure
- Added packaging commands and updated version to 0.0.4
- Added TODO file for tracking future tasks
- Configured build directory to be ignored, with project root set to current top-level directory
- Added zlgcan.node file to support CAN communication

### Technical Details
- Added proper device type constants matching the ZLGCAN library definitions
- Implemented proper handling of native module outputs to the lib directory
- Enhanced testing framework to support dual-channel CAN communication verification
- Created proper integration between the VSCode extension and ZLGCAN native library

### Commits Included
- c00f665: Added TODO file
- 108ee1f: Added packaging command and updated version to 0.0.4
- fb72cd2: Added setValue and getValue methods for device property configuration
- 25710fc: Added ZLGCAN secondary development library manual and zlgcan.node file
- 1a81e32: Added CANFD send/receive support and fixed test failures
- f623b23: Improved test code to support dual-channel send/receive verification
- 69f3a70: Updated device type constants according to zlgcan.h definitions
- 99f332a: Fixed native module build and copy process
- 72b5d33: Resolved compilation errors by adding typedef.h file from ZLGCAN library
- 3c5235f: Ignored build directory and set project root to current top-level directory
- 5b2f603: Updated package.json to add native module build and test scripts
- a914c76: Added ZLGCAN device test code
- c08caa3: Configured Node native module output to lib directory with encapsulated calls
- 4a0d5fb: Added ZLGCAN device code
- 422214e: Implemented code perspective functionality