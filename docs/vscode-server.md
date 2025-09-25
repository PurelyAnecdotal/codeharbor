# OpenVSCode Server Setup

CodeHarbor requires a build of openvscode-server to downloaded on the host so it can be read-only bind-mounted into workspaces to allow remote access. This way, only a single copy is needed for all workspaces.

Download and extract it from https://github.com/gitpod-io/openvscode-server/releases/latest. The `OPENVSCODE_SERVER_MOUNT_PATH` [environment variable](environment-variables.md) should be set to the path of the extracted folder.

## Using the VSCode Extension Marketplace

By default, openvscode-server is configured to use the Open VSX extension marketplace, which  extensions are not available there. To use the Microsoft VSCode Marketplace instead, you will need to patch some of the build files. Note that using the VSCode Extension Marketplace in this context is a violation of its terms of service.


| Find                                | Replace                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| https://open-vsx.org/vscode/gallery | https://marketplace.visualstudio.com/_apis/public/gallery |
| https://open-vsx.org/vscode/item    | https://marketplace.visualstudio.com/items                |
|                                     |                                                           |
