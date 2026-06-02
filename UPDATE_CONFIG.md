# StoryClaw 自动更新配置

## 概述

StoryClaw 使用 `electron-updater` 实现自动更新功能，已配置为从 GitHub Releases 获取更新。

## 自动更新接口

### 更新检查端点
```
https://github.com/JallyHe/storyclaw/releases/download/v{version}/latest.yml
```

### 当前最新版本
- **版本**: `v0.1.0`
- **发布日期**: `2026-06-02`
- **Release 页面**: https://github.com/JallyHe/storyclaw/releases/tag/v0.1.0

## 文件清单

发布的文件包括：
- `StoryClaw-Setup-0.1.0.exe` - Windows 安装程序
- `StoryClaw-Setup-0.1.0.exe.blockmap` - 增量更新支持文件
- `latest.yml` - 更新元数据（自动生成）

## 工作流程

1. **应用启动时**：electron-updater 自动检查 `latest.yml`
2. **版本比较**：比较本地版本与远程最新版本
3. **下载更新**：如果有新版本，自动下载 exe 文件
4. **重启更新**：提示用户重启应用以完成更新

## 发布新版本步骤

1. 更新 `package.json` 中的 `version` 字段
2. 运行编译和打包：
   ```bash
   npm run dist
   ```
3. 创建 GitHub Release：
   ```bash
   gh release create v{version} -t "StoryClaw v{version}" -n "Release notes" release/*.exe release/*.blockmap release/latest.yml
   ```

## 配置位置

- **electron-builder 配置**: `package.json` → `build.publish`
- **更新检查代码**: 应用启动时自动调用 electron-updater

## 注意事项

- `latest.yml` 文件由 electron-builder 自动生成，包含 SHA512 校验和
- 支持增量更新（通过 `.blockmap` 文件）
- 所有下载均来自 GitHub CDN，确保安全性和可靠性
