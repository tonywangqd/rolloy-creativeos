# Claude Code 项目规则

## 提交规则

每次完成功能修改后，必须执行以下步骤：

1. **更新版本号**
   - `package.json` 中的 `version` 字段
   - `components/layout/version-badge.tsx` 中的 `VERSION` 常量

2. **更新时间戳**
   - `components/layout/version-badge.tsx` 中的 `BUILD_TIMESTAMP`
   - 使用北京时间格式：`YYYY-MM-DDTHH:MM:SS+08:00`
   - 获取当前北京时间命令：`TZ='Asia/Shanghai' date '+%Y-%m-%dT%H:%M:%S+08:00'`

3. **提交并推送到 GitHub**
   - `git add -A`
   - `git commit -m "feat/fix: 描述 (vX.X.X)"`
   - `git push origin main`

## 版本号规则

- 主要功能：增加次版本号（如 3.22.0 -> 3.23.0）
- 小功能/优化：增加修订号（如 3.22.2 -> 3.22.3）
- Bug修复：增加修订号（如 3.22.2 -> 3.22.3）
