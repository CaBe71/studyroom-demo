# 阅间 · 自习室预约与签到（模拟数据演示版）

在线体验：[打开 GitHub Pages 演示](https://cabe71.github.io/studyroom-demo/)

这是一个 Vue 3 + Vite 的纯静态演示项目，使用模拟账号和浏览器 `localStorage` 保存数据。无需 Java、MySQL 或付费服务器。所有资源随站点提供，不调用后端 API，也不依赖外部 CDN。

## 演示账号

| 身份 | 账号 | 密码 |
| --- | --- | --- |
| 学生（林同学） | `student` | `Study@2026` |
| 学生（陈同学） | `student2` | `Study@2026` |
| 管理员 | `admin` | `Study@2026` |

登录页提供一键体验。这些账号只是演示入口，不是真实的身份认证。

## 功能与演示方法

- 学生：查看自习室、按日期和时段选座、预约、签到、取消预约、筛选历史记录。
- 管理员：查看近7天趋势、管理预约、新建自习室、启停场地和座位、查看操作记录。
- 内置2间自习室、48个座位、历史及未来预约，涵盖待签到、使用中、已完成、已取消、已失约。
- 演示时间初始为访问当天北京时间09:05，随后随真实时间流逝。顶部可向前调整演示时间或推进15分钟。
- 签到演示：使用 `student` 进入“我的预约”，当天预置预约可立即签到。未来预约可点击“演示：跳到签到时间”。
- 失约演示：重置后不签到，推进15分钟，预置待签到预约将变为已失约，座位释放。
- 自动完成：签到后通过演示时间控制跳到时段结束，查看已完成记录。
- 重置：顶部“重置数据”需二次确认，仅清除本演示在当前浏览器中的数据，保留当前登录身份。

预约规则在前端模拟：同一账号同一日期时段只保留一个有效预约；已占座位不可重复预约；提前预约从时段开始计算15分钟签到窗口，当前时段补约从提交时计算；剩余时间须大于15分钟；有效预约阻止停用场地或座位。

数据仅在同一浏览器、同一网站来源内共享。不同访客、不同浏览器、不同设备互不影响。关闭页面期间没有后台任务，重新打开或操作时会按演示时间补做状态检查；页面打开时每30秒检查。清除网站数据会丢失本地操作。该版本适合教学演示，不提供真实身份认证、服务端并发控制和多人共享数据库。

## 本地运行

需要 Node.js 22.12+（推荐已安装的 Node.js 24）。在本文件夹打开终端：

```powershell
npm.cmd ci
npm.cmd run dev
```

访问终端显示的地址（默认 `http://127.0.0.1:5173/`）。也可双击 `start-demo.cmd`；保留终端窗口，按 Ctrl+C 停止。

这里使用 `npm.cmd`，避免 PowerShell 对 `.ps1` 脚本执行策略的限制。不要直接双击 HTML：页面应通过本地 HTTP 或 GitHub Pages 访问。

## 测试与构建

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

构建结果在 `docs/`。`vite.config.js` 使用相对资源路径，适配 GitHub Pages 的仓库子路径。`public/.nojekyll` 会自动复制到 `docs/.nojekyll`。

## 发布与后续更新

GitHub Pages 使用 `main` 分支的 `/docs` 文件夹发布。仓库中同时保留源码、锁定依赖和构建后的静态资源。无自定义域名、无付费服务。

修改 `src/` 后执行：

```powershell
npm.cmd test
npm.cmd run build
git add src docs package.json package-lock.json vite.config.js public README.md tests
git commit -m "Update studyroom demo"
git push
```

提交构建结果后 GitHub Pages 自动更新。构建文件需与源码一起提交。Pages 设置位置：仓库 Settings → Pages → Deploy from a branch → main → /docs。

## 文件说明

- `src/App.vue`：学生及管理界面、演示时间控制。
- `src/demo.js`：本地模拟接口、业务规则、数据初始化与保存。
- `src/style.css`：桌面及移动端样式。
- `tests/demo.test.js`：关键业务和持久化测试。
- `docs/`：GitHub Pages 发布产物。

本演示独立于原 Java 完整项目；原项目仍可用于后端与数据库实训验收。
