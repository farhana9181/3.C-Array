# Change Log

## 0.9.0 - 2023-03-20

### Added

- Toggle button that controls whether an echo of what was sent to the serial port is printed. [#79](https://github.com/microsoft/vscode-serial-monitor/issues/79)
- Checkboxes for setting DTR and RTS COM output lines in the serial monitor additional settings. Default values are both DTR and RTS being checked/true (both set active low). [#27](https://github.com/microsoft/vscode-serial-monitor/issues/27)

### Fixed

- Label colors in dark themes.
- Context menu copy not working. Also added a `Clear Output` button.

### Changed

- Automatically adds spaces in typed input for sending hex and binary encoded messages. [#61](https://github.com/microsoft/vscode-serial-monitor/issues/61)
- In VS Code Remote scenarios, we switched back to having the extension to prefer running remotely. To override this behavior, use the `remote.extensionKind` setting.

## 0.8.0 - 2023-02-15

### Added

- Changed our text view implementation to support ASNI color codes and terminal escape codes. [#46](https://github.com/microsoft/vscode-serial-monitor/issues/46)
- Added the ability to send empty messages.
- Added [an experimental API](https://www.npmjs.com/package/@microsoft/vscode-serial-monitor-api) for communicating with the Serial Monitor extension [#20](https://github.com/microsoft/vscode-serial-monitor/issues/20). This API should be considered unstable until it reaches version 1.0.0.
- Added a setting for modifying the font size of text output pane, `vscode-serial-monitor.outputFontSize` [#57](https://github.com/microsoft/vscode-serial-monitor/issues/57).
- A manual refresh button to manually refresh the port list [#62](https://github.com/microsoft/vscode-serial-monitor/issues/62).
- Added the ability to send common control signals (Ctrl+C, Ctrl+D, Ctrl+X, Ctrl+Z). [#22](https://github.com/microsoft/vscode-serial-monitor/issues/22)
- Added the ability to select message encoding (utf-8, hex, binary). Only multiples of 1 byte of data can be sent. [#61](https://github.com/microsoft/vscode-serial-monitor/issues/61)
- Added a setting for modifiying the timestamp format as well as the timestamp separator. [#75](https://github.com/microsoft/vscode-serial-monitor/issues/75).

### Changed

- Enabled autoscroll by default and added persistence for autoscroll and show timestamp settings. [#52](https://github.com/microsoft/vscode-serial-monitor/issues/52)
- In VS Code Remote scenarios, the extension now prefers running locally. This provides access to locally connected devices by default instead of devices connected to the remote environment. To override this behavior, use the `remote.extensionKind` setting. [#25](https://github.com/microsoft/vscode-serial-monitor/issues/25)
- Updated styling to better reflect VSCode's overall styling.

### Fixed

- Issue with scrolling in the text view.

## 0.7.0 - 2022-12-05

### Fixed

- Fixed some bugs.

## 0.6.0 - 2022-11-30

### Added

- Added TCP Support to the serial monitor [#15](https://github.com/microsoft/vscode-serial-monitor/issues/15)
- Added Serial Wire Output (SWO) support in TCP monitoring.
- Added auto-reconnection feature. When enabled, the serial monitor will block when a port is disconnected until the port is reconnected. [#33](https://github.com/microsoft/vscode-serial-monitor/issues/33)

### Changed

- How control characters are handled. They are now stripped from the input data so the text view looks cleaner.
- Changed styling of additional settings and additional settings button (gear icon) to make connection more obvious

### Fixed

- Fixed Open Additional Serial Monitor button's icon color issue
- Pulled in an updated dependency to fix port name localization issues. [#47](https://github.com/microsoft/vscode-serial-monitor/issues/47)

## 0.5.0 - 2022-10-18

### Fixed

- Fixed some bugs

## 0.4.0 - 2022-10-12

### Added

- Added milliseconds to the timestamp
- Added ability to open multiple serial monitors concurrently.

### Changed

- Switched from choosing log files to choosing log directories. Log files are now given a unique timestamp-based name when a monitor session is started.

## 0.3.0 - 2022-08-31

### Fixed

- Updated our node-usb dependency to fix device connection handling.
- Fixed accessibility bugs related to tabbing through UI components.

## 0.2.0 - 2022-07-28

### Added

- Additional settings to configure port monitoring: Data bits, Stop bits, Parity.
- Ability to log to a file, choose desired log file, and open the log file.
- Ability to navigate history of sent messages in text field.
- Support for settings.json configurations and custom baud rate.
- Add system message on sending a message to the port.

### Fixed

- Fixed the font in the output window, while ensuring the text view calculated positions correctly. 
- Restored tooltips for dropdowns/buttons/etc.
- Fixed bug where serial port connections didn't close when webview moved to new container.
- Edited the activation event to only activate when the Serial Monitor view is opened. 
- Color of additional settings icon when disabled.

## 0.1.0 - 2022-06-06

Initial Release.