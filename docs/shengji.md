# 分镜大师科普版 — 升级流程

> **适用范围**：`D:\Story-Science`（小鸭分镜大师 · 科普版，版本线 v1.3.x，远端 `origin` =
> `yaojie-sun/storyboard-science`）。这是科普版**自己的**发版 SOP，不要套用短视频版/服饰版的
> 口令 —— 三者远端名、下载页路径、技能包名都不同。
>
> **同源参考**：`docs/port-step-gate-direct-video.md` 记录了短视频版基线（→ v1.0.79）
> 的全部改动与踩坑，本 SOP 的四条硬规则（§八 / 步骤 7）都来自那份记录。

本文档涵盖两种升级链路：

- **程序本体升级**（第一章~第九章）：构建 → 上传 → 版本检测 → 下载 → 安装
- **技能升级**（第十章）：SKILL.md 迭代 → 打包上传 → 客户端**登录时自动**同步

---

## 一、架构总览

```
开发机                       服务器                          用户机器
───────                     ────────                        ────────
1. npm run release          2. GitHub Actions              3. 分镜大师启动
   打 tag 推远端               自动构建 .dmg                  check_for_upgrade()
                                                           ↓
4. npm run tauri build      5. 上传 .exe 到服务器             发现新版本
   本地构建 Windows NSIS       /jy/uploads/app/              弹 UpdateAvailableDialog
                              （中文原名 + 英文名副本）         ↓
                            6. 更新 version_science.json  用户点击"直接下载安装"
                            7. 更新 install_guide 页面
                               写入新版本号+下载地址+更新日志   download_upgrade()
                                                           ↓
                                                           emit download-progress
                                                           进度条实时显示
                                                           ↓
                                                           launch_installer()
                                                           启动 NSIS 安装程序
                                                           当前进程 exit(0)
                                                           ↓
                                                           用户走完 NSIS 安装向导
                                                           新版本覆盖安装完成
```

### 关键文件清单

| 层 | 文件 | 作用 |
|----|------|------|
| 版本检测 JSON | `https://aixiaoxi.top/jy/uploads/app/version_science.json` | 服务器上存放最新版本信息 |
| Rust 命令 | `src-tauri/src/commands/update.rs` | 版本比较、下载、启动安装程序 |
| Rust 注册 | `src-tauri/src/lib.rs` | 注册 3 个 Tauri 命令 |
| 前端命令 | `src/commands/update.ts` | `checkForUpgrade()` 封装 |
| 前端 UI | `src/components/UpdateAvailableDialog.tsx` | 升级弹窗 + 进度条 |
| 前端入口 | `src/App.tsx` | 启动时调用 `checkForUpgrade` |
| 构建配置 | `src-tauri/tauri.conf.json` | NSIS 安装模式 `currentUser` |
| 发布脚本 | `scripts/release.mjs` | 自动 bump 版本 + tag + push origin |
| 版本同步 | `scripts/sync-version.mjs` | 同步 package.json / Cargo.toml / tauri.conf.json（**只有 4 个文件**，见 §7 补充） |
| CI/CD | `.github/workflows/build.yml` | tag 推送 origin → GitHub Actions 构建 macOS Universal DMG 并 SCP 到服务器 |
| Git remote | `origin` | 唯一远端 `yaojie-sun/storyboard-science`（构建 + 备份同此一个） |

---

## 二、服务器端：版本信息 JSON

### 2.1 文件位置

```
https://aixiaoxi.top/jy/uploads/app/version_science.json
```

### 2.2 JSON 格式

```json
{
  "version": "1.0.29",
  "releaseDate": "2026-06-01",
  "downloadUrl": "https://aixiaoxi.top/jy/uploads/app",
  "notes": "## 新增\n- xxx功能\n## 修复\n- yyy问题"
}
```

### 2.3 字段说明

| 字段 | 必需 | 说明 |
|------|------|------|
| `version` | 是 | 最新版本号，不带 `v` 前缀。客户端用语义版本比较（major.minor.patch） |
| `releaseDate` | 是 | 发布日期，展示用 |
| `downloadUrl` | 是 | 安装包所在目录的 **基础 URL**（不含文件名）。文件名由客户端按规则拼接 |
| `notes` | 否 | 更新日志，Markdown 格式。**不能出现模型名称**；**≤300 字**（弹窗正文区无 max-height，写长了会把下载按钮顶出屏幕，见步骤 1） |

### 2.4 安装包命名规则

客户端根据操作系统自动拼接文件名：

- **Windows**: `Storyboard-Science_{version}_x64-setup.exe`
- **macOS**: `Storyboard-Science_{version}_universal.dmg`

代码位置：`src-tauri/src/commands/update.rs` → `installer_name()`

### 2.5 上传新版本的步骤

1. 构建安装包（见第三节）
2. 将安装包上传到服务器 `/jy/uploads/app/` 目录（**中文原名 + 英文名副本，两个都要**）
3. 编辑**本仓库的** `public/version_science.json`，更新 `version`、`releaseDate`、`notes` 字段
4. 上传覆盖服务器上的 `/jy/uploads/app/version_science.json`
5. 提交 `public/version_science.json`（`release.mjs` 的 `git add` 名单里没有它）

> ⚠️ **第 3/4 步必须等 Windows exe 与 macOS dmg 都在服务器上**（见阶段二步骤 7 的铁律）。

---

## 三、构建安装包

### 3.1 前提条件

- Windows 构建机需安装 NSIS（Nullsoft Scriptable Install System）
- Rust 工具链已安装
- Node.js 20+

### 3.2 Windows NSIS 构建（本地）

在 Windows 开发机上执行：

```bash
# 在项目根目录执行
npm run tauri build
```

构建产物位置：
```
src-tauri/target/release/bundle/nsis/Storyboard-Science_{version}_x64-setup.exe
```

### 3.3 macOS 构建（GitHub Actions 自动）

macOS DMG **不本地构建**，由 GitHub Actions 在 tag 推送到 `origin` 后自动触发。

- 触发条件：`git push origin v{版本号}`（release 脚本自动执行）
- 配置文件：`.github/workflows/build.yml`
- 需在 `yaojie-sun/storyboard-science` 仓库 Settings → Secrets 中配置：`QINIU_ACCESS_KEY`、`QINIU_SECRET_KEY`、`QINIU_BUCKET`、`QINIU_DOMAIN`、`DEEPSEEK_API_KEY`
- **CI 自己会 SCP**：构建完成后 workflow 直接把 dmg 传到 `root@47.108.237.10:/jy/uploads/app/`（`Upload DMG to server (SCP)` 步骤）——所以 dmg 不需要手工上传，但**要等它传完**（见阶段二步骤 7 的半成品探测）
- 产物：`Storyboard-Science_{version}_universal.dmg`（Universal Binary，同时支持 Apple Silicon + Intel）

---

## 四、版本发布流程（两阶段 SOP）

> ⚠️ **铁律**：先本地测试，确认升级链路正常后再正式发布。不要直接推送到生产环境。

### 阶段一：本地测试构建

当用户说"构建升级SOP"或"构建测试版"时执行。

#### 步骤 1：准备发布日志

创建 `docs/releases/v{版本号}.md`，格式：

```markdown
## 新增
- 功能A描述
- 功能B描述

## 优化
- 改进C描述

## 修复
- 修复D描述
```

> **铁律：发布日志中绝对不能出现模型名称。**

**同一个日志有两种用途，两套长度**：

| 用途 | 位置 | 长度 |
|---|---|---|
| 完整日志（给人看 · 进 tag 正文） | `docs/releases/vx.y.z.md` | 不限 |
| 客户端升级弹窗 | `version_science.json` 的 `notes` | **≤300 字** |

> 🔴 **弹窗那条必须短**：`UiModal`（`src/components/ui/primitives.tsx:492`）正文区**没有 max-height、也没有 overflow**，
> 日志一长就把「直接下载安装」按钮顶出屏幕，用户点不到、也无处可滚 —— 这是短视频版 v1.0.78 的
> **真实线上事故**（用户原话「更新日志太长了，用户根本看不到下载按钮」），v1.0.79 才给升级弹窗
> 单独加了限高兜底。科普版已同步该兜底（`UpdateAvailableDialog.tsx:136` 的 `max-h-[38vh]`）。
> 详见 `docs/port-step-gate-direct-video.md` §3.13。

#### 步骤 2：预检（必须全部通过才能构建）

```bash
# ① 代码通畅检查
npx tsc --noEmit          # TypeScript 零错误
cd src-tauri && cargo check  # Rust 零错误

# ② 改动范围检查
git diff {last_tag}..HEAD --stat  # 确认所有变更文件在预期范围内

# ③ 关键链路快速验证（扣费/退费、配置存取、同步）
```

#### 步骤 3：同步版本号 + 本地构建

```bash
# ① 版本号自动递增 patch（同步 package.json / Cargo.toml / tauri.conf.json 三文件）
node scripts/sync-version.mjs {新版本号}

# ② 同步 public/version_science.json 的 version 字段（手工改，脚本不管它）

# ③ 本地构建 Windows NSIS
npm run tauri build
```

#### 步骤 4：本地测试

构建产物：`src-tauri/target/release/bundle/nsis/Storyboard-Science_{version}_x64-setup.exe`

1. 双击安装包覆盖安装旧版本
2. 启动新版本，验证核心链路（登录 → 对话 → 宫格生成 → 视频生成 → 历史记录）
3. 验证数据不丢失（config、history、项目数据）
4. 如发现问题，修复后重新从步骤 1 开始

### 阶段二：正式发布

用户确认测试通过后执行。

#### 步骤 5：执行发布命令

🔴 **要用「显式版本号」写法，不能用 `patch`**：

```bash
# ✅ 正确：发布的就是阶段一本地测过的那一版
npm run release -- 1.3.1 --notes-file docs/releases/v1.3.1.md

# ❌ 错误：阶段一已经把版本号推到 1.3.1 了，
#    再跑一次 patch 会变成 1.3.2 —— 你测的是 1.3.1，发出去的却是 1.3.2
npm run release -- patch --notes-file docs/releases/v1.3.1.md
```

`release.mjs` 的第一个参数既接受 `major` / `minor` / `patch`（在**当前**版本上再递增），
也接受**显式版本号**（形如 `1.3.1`）。阶段一已经递增过一次，所以阶段二必须给显式版本号。

| 写法 | 含义 |
|---|---|
| `1.3.1` | **发布这个确切版本**（阶段二应始终用这种） |
| `patch` | 在 package.json 当前版本上 +1（1.3.0 → 1.3.1） |
| `minor` | 在 package.json 当前版本上进次版本（1.3.0 → 1.4.0） |
| `major` | 在 package.json 当前版本上进主版本（1.3.0 → 2.0.0） |

> 版本号若已存在同名 tag，脚本会直接 `fail` 退出（`Tag v1.3.1 already exists.`）——
> 这是防重复发布，不是故障。

脚本自动执行：
1. `git commit` 提交版本变更
2. `git tag -a v{版本号}` 打 annotated tag（包含更新日志）
3. `git push {远端} {branch}` + `git push {远端} {tag}` → 触发 macOS 构建

> 🔴 **远端名要在推之前实测，别照抄**。科普版**只有一个远端**：
>
> ```bash
> git remote -v
> # origin  https://github.com/yaojie-sun/storyboard-science.git (fetch/push)
> ```
>
> `scripts/release.mjs` 里硬编码的就是 `git push origin <branch>` + `git push origin <tag>`，
> 所以只要 `origin` 通就一切正常。推之前只读验一遍（不需要任何写权限）：
>
> ```bash
> GIT_TERMINAL_PROMPT=0 git ls-remote --heads origin >/dev/null 2>&1 && echo OK || echo FAIL
> ```
>
> ⚠️ **不要照抄短视频版 SOP 里的 `sunsh0704` / `ci` / `ci-mac` / `gitee`** —— 那是短视频版
> 仓库的远端名（那边 token 大面积失效过），科普版仓库里不存在这些 remote，`git push sunsh0704`
> 会直接报 `'sunsh0704' does not appear to be a git repository`。
>
> tag 推上去后 CI（`.github/workflows/build.yml`）会自己构建 macOS Universal DMG 并 SCP 上传（见步骤 7.1）。

### 步骤 6：上传安装包到服务器

> ⚠️ **文件名铁律**：客户端升级代码硬编码查找 `Storyboard-Science_{version}_x64-setup.exe`（英文名）。必须同时上传中文原名 + 这份英文副本，否则升级报 1392 错误。

1. 上传 NSIS 安装包（中文原名 `小鸭科普版_{version}_x64-setup.exe`）到 `/jy/uploads/app/`
2. 在服务器上复制一份英文名副本：`cp 小鸭科普版_{version}_x64-setup.exe Storyboard-Science_{version}_x64-setup.exe`
3. **等 macOS dmg 就位**（CI 自动 SCP，见步骤 7.1）
4. 两个平台产物都齐了，**才**传 `public/version_science.json`（先改本地文件，再 scp 覆盖服务器）
5. 更新新用户下载页面（见步骤 7.2）
6. 手工提交 `public/version_science.json` + `public/industry.html`（`release.mjs` 不管这两个）

> 科普版下载页**不依赖 `-latest` 固定文件名**（那是短视频版的做法）：页面用带版本号的绝对链接，
> 新用户和老用户走的是同一批文件 ⇒ 不需要额外传一份 `-latest` 兜底副本。

> 🔴 **`version_science.json` 不能提前翻**：客户端拿着它 + `update.rs:66 installer_name()`
> **按平台拼下载地址**（Windows `Storyboard-Science_{v}_x64-setup.exe` / macOS
> `Storyboard-Science_{v}_universal.dmg`）。
> 只传了 Windows 就翻版本号 ⇒ macOS 用户点「直接下载安装」直接 404。
> **必须等两个平台的产物都在服务器上。**

### 步骤 7：等 macOS dmg 就位 + 更新下载页面

**7.1 等 dmg 上传完**（tag 推送后 CI 自动构建并 SCP 上传，实测**约 7 分钟**）：

```bash
# 🔴 dmg 是「边写边可访问」的：SCP 期间 curl -I 就已经返回 200，
#    而 Content-Length 是当时的半成品大小（实测 128MB → 最终 279MB）。
#    必须连续两次读数一致、且量级合理（>250MB）才能往下走，
#    否则用户会下到截断的 dmg，报「文件校验失败」。
for i in $(seq 1 10); do
  date "+%H:%M:%S"
  curl -sI "http://47.108.237.10/jy/uploads/app/Storyboard-Science_{version}_universal.dmg" \
    | grep -i "content-length"
  sleep 60
done
```

**7.2 更新下载页面**（`http://47.108.237.10/jy/uploads/install_guide/industry.html`，各行业共用一张）：

科普版的卡片在 `public/industry.html` 的 **L644-647** 附近，Windows / macOS 两个按钮都是
**带版本号的绝对链接**：

```html
<a href="http://47.108.237.10/jy/uploads/app/Storyboard-Science_{版本}_x64-setup.exe" download class="btn-dl">Windows</a>
<a href="http://47.108.237.10/jy/uploads/app/Storyboard-Science_{版本}_universal.dmg" download class="btn-dl">macOS</a>
```

> 🔴 **按行定点替换，禁止全局 `sed`**。`industry.html` 里**六七个行业的卡片共用同一批
> `Storyboard-*` 命名**，全局替换一行就可能顺手动到服饰/萌宠/美妆/大健康/旅游版。
> 而且 mac 按钮也写死版本号 —— **只发 Windows 时若做全局替换，会把 mac 按钮改成死链**。

```bash
# ① 先备份，备份名沿用「被替换掉的那个版本」
cp public/industry.html public/industry.html.bak.v{被替换版本}
# ② 先看清命中的行是不是科普版那一张卡（行号应在 644-647 附近，且带 Storyboard-Science_）
grep -n "Storyboard-Science_" public/industry.html
# ③ 只改那两行（编辑器定点改，或 sed 带上 '644,647s///' 的行号范围）
# ④ 改完 diff 确认只有科普版的 1-2 行变化
git diff public/industry.html
# ⑤ 上传（服务器上是扁平路径，不带 public/ 前缀）
scp public/industry.html root@47.108.237.10:/jy/uploads/install_guide/industry.html
```

> 改完记得**提交 `public/industry.html`**：`release.mjs`（`sync-version.mjs`）只 bump
> package.json / Cargo.toml / tauri.conf.json 这几个版本文件，**不会自动改下载页**。

### 步骤 8：验证

1. 旧版本客户端启动 → 弹升级对话框 → **先确认三个按钮都在屏幕内可见**（日志过长会顶出按钮，见步骤 1）
   → 点击"直接下载安装" → 验证完整链路（确认无 1392 错误）
2. 浏览器访问 `http://47.108.237.10/jy/uploads/install_guide/industry.html` → 滚到科普版卡片，确认**两个平台**的版本号都对
3. 分别 `curl -I` 两个平台的下载地址 → 都是 200 且 `Content-Length` 量级正常（不是半成品）

---

## 五、客户端升级流程（代码级）

### 5.1 启动时检测（App.tsx）

```typescript
// 应用启动后自动检测
const result = await checkForUpgrade(appVersion);
if (result.hasUpdate && result.latestVersion && result.downloadUrl) {
  setUpdateInfo({ ... });
  setShowUpdateDialog(true);
}
```

### 5.2 版本比较逻辑（Rust）

```rust
// src-tauri/src/commands/update.rs

// 1. 获取当前版本（优先用 Rust 编译期 CARGO_PKG_VERSION）
let current = normalize_version(env!("CARGO_PKG_VERSION"));

// 2. 请求服务器 version_science.json
let version_info = reqwest::get(VERSION_CHECK_URL).await?;

// 3. 语义版本比较 (major.minor.patch)
let has_update = compare_versions(&latest, &current) == Ordering::Greater;

// 4. 拼接下载地址
let download_url = format!("{}/{}", base_url, installer_name(&latest));
// 结果: https://aixiaoxi.top/jy/uploads/app/Storyboard-Science_1.0.29_x64-setup.exe
```

### 5.3 下载 + 进度推送（Rust）

```rust
// download_upgrade 命令

// 1. 创建临时目录 %TEMP%/storyboard-upgrade/
// 2. 流式下载，每收到一个 chunk 就 emit 进度事件
app.emit("download-progress", DownloadProgress {
    downloaded_bytes,
    total_bytes,
    percentage,  // 0-100
});

// 3. 下载完成后校验文件大小
let actual_size = std::fs::metadata(&file_path)?.len();
if total_bytes > 0 && actual_size != total_bytes {
    // 校验失败，删除文件，返回错误
    return Err("文件校验失败");
}
```

### 5.4 前端进度展示（UpdateAvailableDialog.tsx）

```typescript
// 监听 Rust 后端 emit 的 download-progress 事件
const unlisten = await listen<DownloadProgress>('download-progress', (event) => {
    setProgress(event.payload);
});

// 进度条 UI
<div className="h-3 rounded-full bg-bg-dark">
  <div style={{ width: `${progress.percentage}%` }} />
</div>
// 显示: 12.3 MB / 45.6 MB (27%)
```

### 5.5 启动安装程序（Rust）

```rust
// launch_installer 命令

#[cfg(target_os = "windows")]
{
    // Windows: 直接启动 .exe
    std::process::Command::new(&file_path).spawn()?;
}

#[cfg(target_os = "macos")]
{
    // macOS: 用 open 命令打开 .dmg
    std::process::Command::new("open").arg(&file_path).spawn()?;
}

// 安装程序启动后，立即退出当前进程
std::process::exit(0);
```

> 退出当前进程是必要的：NSIS 安装程序需要覆盖当前运行的 .exe 文件。如果当前进程不退出，安装会失败（文件被占用）。

---

## 六、NSIS 安装模式说明

### 为什么用 `currentUser` 而非 `perMachine`？

| 模式 | 安装路径 | 需要管理员 | 覆盖安装 |
|------|---------|-----------|---------|
| `currentUser` | `%LOCALAPPDATA%/分镜大师科普版/` | 否 | 直接覆盖 |
| `perMachine` | `C:/Program Files/` | 是 | 需 UAC 提权 |

选择 `currentUser` 的原因：
1. 自动升级不需要用户手动确认 UAC 弹窗
2. NSIS 安装程序可以直接覆盖安装旧版本
3. 不需要管理员权限，降低安装门槛

---

## 七、版本号同步机制

发布时以下文件**必须**版本号一致：

| 文件 | 版本字段位置 |
|------|-------------|
| `package.json` | `version` |
| `src-tauri/Cargo.toml` | `[package].version` |
| `src-tauri/tauri.conf.json` | `version` |

`scripts/sync-version.mjs` 负责三文件同步，`scripts/release.mjs` 在发布时自动调用。

### Rust 编译期版本 vs 前端版本

`check_for_upgrade` 命令接收前端传的 `appVersion` 参数，但**优先使用 Rust 编译期版本**：

```rust
let current = if app_version.is_empty() || app_version == "0.0.0" {
    normalize_version(env!("CARGO_PKG_VERSION"))  // 编译时嵌入
} else {
    normalize_version(&app_version)
};
```

这确保了比较的是**实际编译进去的版本**，而非前端可能传错的值。

---

## 八、更新日志规范

> **铁律：更新日志（`notes` 字段）绝对不能包含模型名称。**

原因：更新日志展示在前端弹窗中，用户可见。模型名称属于敏感商业信息，不应暴露给最终用户。

> **第二条铁律：`notes` ≤300 字。**

原因：`UiModal` 正文区（`src/components/ui/primitives.tsx:492`）是裸 `<div className="px-4 py-4">`，
**既无 max-height 也无 overflow**；overlay 是 `flex items-center justify-center` ⇒ 内容超高时面板
上下同时溢出，footer 的「直接下载安装」按钮被推出可视区 ⇒ **用户点不到、也无处可滚 ⇒ 卡死无法升级**。
（短视频版 v1.0.78/v1.0.79 的线上事故，同源代码两边一样。）

**代码侧兜底已做**：`src/components/UpdateAvailableDialog.tsx:136` 的日志 `<pre>` 已加
`max-h-[38vh] overflow-y-auto ui-scrollbar`（38vh + 弹窗其余固定内容 ≈ 470–550px，
最小窗口 600px 下按钮仍可见）。但**代码限高只是兜底，服务端 `notes` 才是第一道闸**。

完整日志写进 `docs/releases/vx.y.z.md`（并作为 tag 正文），`notes` 只留**给用户看的那几句**。

> ⚠️ **未修的同源风险**：`UiModal` 本身仍未限高，其他承载长正文的弹窗同样脆弱。

正确示例：
```json
"notes": "## 新增\n- 视频生成功能\n## 修复\n- 下载进度显示不准确"
```

错误示例：
```json
"notes": "## 新增\n- 接入Wan2.7模型视频生成"   ← 禁止出现模型名
```

---

## 九、新用户下载页面（industry.html）

### 9.1 页面路径

```
线上地址:   http://47.108.237.10/jy/uploads/install_guide/industry.html
本地源文件: public/industry.html（vite 构建时复制到 dist/）
```

### 9.2 页面结构

**这是一张各行业公用的下载落地页**，七个版本各占一屏 `edition-row`，**不只有科普版**：

| 顺序 | row-title | 卡片起始行 | 版本标签行 | Windows 链接行 | macOS 链接行 |
|---|---|---|---|---|---|
| 1 | 旅游专业版 | L367 | L372 | L374 | L377 |
| 2 | 大健康专业版 | L421 | L426 | L428 | L431 |
| 3 | 美妆专业版 | L475 | L480 | L482 | L485 |
| 4 | 服饰专业版 | L529 | L534 | L536 | L539 |
| 5 | 萌宠专业版 | L583 | L588 | L590 | L593 |
| **6** | **科普专业版** | **L637** | **L642** | **L644** | **L647** |
| 7 | 短视频专业版 | L691 | L696 | L698 | L701 |

科普版卡片长这样（每个卡片结构完全相同，只有 `--accent` 配色、图标、文案与版本号不同）：

```html
<!-- 科普专业版 -->
<div class="edition-row" style="--accent:#5bc0eb;--accent-rgb:91,192,235;">
  …
  <div class="row-title">小鸭分镜大师 &middot; 科普专业版<span class="row-version">v1.3.0</span></div>
  <div class="row-downloads-inline">
    <a href="http://47.108.237.10/jy/uploads/app/Storyboard-Science_1.3.0_x64-setup.exe" download class="btn-dl">
      <span class="dl-icon">⊞</span> Windows 下载
    </a>
    <a href="http://47.108.237.10/jy/uploads/app/Storyboard-Science_1.3.0_universal.dmg" download class="btn-dl">
      <span class="dl-icon">⌘</span> macOS 下载
    </a>
  </div>
  …
</div>
```

> **注意**：七个版本是**彼此独立的产品线**，各有自己的版本号体系
> （科普版 1.3.x、短视频版 1.0.x、大健康版 3.0.x…），互不同步，不要混淆。

### 9.3 发版时需修改的位置

科普版发版**只改 3 行**（按钮文案里不含版本号，所以按钮文字不用动）：

| 行 | 改什么 |
|---|---|
| **L642** | `<span class="row-version">v{旧}</span>` → `v{新}` |
| **L644** | Windows 链接的 `Storyboard-Science_{旧}_x64-setup.exe` → `_x64-setup.exe`(新版本) |
| **L647** | macOS 链接的 `Storyboard-Science_{旧}_universal.dmg` → `_universal.dmg`(新版本) |

> 🔴 **按行定点替换，禁止全局 `sed`**。同一张页面里七个版本的链接**结构完全一样**，
> 只差 `Storyboard-{Vertical}` 这一段前缀 —— 一条 `s/_[0-9.]*_x64-setup\.exe/…/g` 就会
> **顺手把旅游/大健康/美妆/服饰/萌宠/短视频六个版本的卡片一起改掉**，把别人的下载按钮全打成死链。
> （服饰版 SOP 里那句全局 `sed` 是**反面教材**，本次已在本文件改正。）

```bash
# ① 先备份
cp public/industry.html public/industry.html.bak.v{被替换版本}
# ② 先确认命中的就是要改的那 3 行（应落在 642/644/647，且带 Science_）
grep -n "Storyboard-Science_" public/industry.html
# ③ 只改那 3 行（把 OLD/NEW 换成实际版本号；编辑器定点改同样可以）
OLD=1.3.0 NEW=1.3.1
sed -i "642s/v${OLD//./\\.}/v$NEW/; \
        644s/Storyboard-Science_${OLD//./\\.}/Storyboard-Science_$NEW/; \
        647s/Storyboard-Science_${OLD//./\\.}/Storyboard-Science_$NEW/" public/industry.html
# ④ diff 必须只有那 3 行变化
git diff public/industry.html
# ⑤ 上传（服务器上是扁平路径，不带 public/ 前缀）
scp public/industry.html root@47.108.237.10:/jy/uploads/install_guide/industry.html
```

> ⚠️ **下载页要记得提交**：`release.mjs` 的 `git add` 名单**只有 5 个文件** ——
> `package.json` / `package-lock.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` /
> `src-tauri/tauri.conf.json`，**不含下载页、也不含 `public/version_science.json`**。
> ⇒ 每次发版都要**手工追加一次提交**：
> ```bash
> git add public/industry.html public/version_science.json
> git commit -m "chore(release): 同步下载页与版本信息 v{版本号}"
> ```

### 9.4 安装包文件路径对应关系

页面里的链接是**带版本号的绝对路径**（不是相对路径），指向 `/jy/uploads/app/`：

| 平台 | 页面链接 | 服务器落点 |
|---|---|---|
| Windows | `http://47.108.237.10/jy/uploads/app/Storyboard-Science_{版本}_x64-setup.exe` | `/jy/uploads/app/Storyboard-Science_{版本}_x64-setup.exe`（英文名副本） |
| macOS | `http://47.108.237.10/jy/uploads/app/Storyboard-Science_{版本}_universal.dmg` | `/jy/uploads/app/Storyboard-Science_{版本}_universal.dmg`（CI 自动 SCP） |

> **新用户和老用户下载的是同一批文件**（都从 `/jy/uploads/app/` 取带版本号的文件名）
> ⇒ 科普版**不需要**再往 `xiaoya-studio/` 之类目录传一份 `-latest` 兜底副本。

### 9.5 升级 SOP 中涉及的服务器文件汇总

| 文件 | 路径 | 用途 |
|------|------|------|
| 科普版 Windows 安装包 | `/jy/uploads/app/Storyboard-Science_{版本}_x64-setup.exe` | 客户端自动升级 + 新用户下载（同一个文件） |
| 科普版 macOS 安装包 | `/jy/uploads/app/Storyboard-Science_{版本}_universal.dmg` | 同上（CI 构建后自动 SCP） |
| 版本信息 | `/jy/uploads/app/version_science.json` | 客户端启动时检测升级（`update.rs` 据此拼 per-platform 下载地址） |
| 下载页面 | `/jy/uploads/install_guide/industry.html` | 各行业公用新用户下载落地页 |
| 技能包 | `/jy/uploads/install_guide/files/xiaoya-ai-cinema-science.zip` + `version_science.txt` | 客户端登录时自动同步（见 §10） |

**上传顺序**（科普版发版）：
1. 安装包 → 保留版本号文件名（中文原名 + 英文名副本），上传到 `/jy/uploads/app/`
2. 等 CI 把 `_universal.dmg` SCP 完（连续两次 `Content-Length` 读数一致才继续）
3. `version_science.json` → 更新版本号、下载地址、更新日志（**两个平台都齐了才能翻**）
4. 改 `public/industry.html` 那 3 行 → 上传 `industry.html` → 提交 git

---

## 十、技能升级流程（xiaoya-ai-cinema-science）

技能（SKILL.md）是 AI 对话生成分镜提示词的核心规则文件，独立于程序本体进行版本迭代。

### 10.1 架构概览

```
开发机                             服务器                              用户机器
───────                            ────────                            ────────
1. 修改 SKILL.md                   2. 打包 zip 上传                      3. 登录后 sync_post_login_tasks()
   + version.txt                   47.108.237.10                       自动对比
                                   /jy/uploads/install_guide/files/    ~/.claude/skills/xiaoya-ai-cinema-science/
                                   xiaoya-ai-cinema-science.zip        version.txt
                                   version_science.txt                 vs version_science.txt
                                                                        ↓
                                                                   不一致 → rm -rf 旧目录
                                                                   → 下载 zip → 解压覆盖
```

> ⚠️ **这不是「用户确认后才升级」，而是每次登录自动同步** —— 见 `banana_api.rs` 的
> `sync_post_login_tasks()` → `sync_xiaoya_skill()`。判定条件是**整个 version.txt 文件
> 逐字相等**（`remote.trim() == local.trim()`），不是比较版本号 ⇒
> **改一个字的 changelog 也会触发全量重下**。
> 这条特性直接决定了 §10.6 的「技能不能先于客户端发布」铁律。

### 10.2 涉及的关键文件和路径

| 文件 | 位置 | 作用 |
|------|------|------|
| **技能源文件** | `D:\Story-Science\docs\skills\{SKILL.md, version.txt}` | **本仓库内维护**（不再有独立的 `D:\Story\skills\` 仓库） |
| 本地安装目录 | `~/.claude/skills/xiaoya-ai-cinema-science/` | 用户机器上技能存放位置（登录时被自动覆盖） |
| 服务器 zip | `http://47.108.237.10/jy/uploads/install_guide/files/xiaoya-ai-cinema-science.zip` | 技能打包下载 |
| 服务器版本 | `http://47.108.237.10/jy/uploads/install_guide/files/version_science.txt` | 版本检测（**整文件逐字比对**） |
| 运行时规则块 | `src-tauri/src/commands/writer_rules/*.md`（`chat.rs` 里 `include_str!`） | 运行时最高权威，格式变更必须同步 |
| 规则文件 | `public/video_gen_rules_*.json` | 分模型视频生成规则 |

### 10.3 发版 SOP（8 步）

#### 步骤 1：修改核心文件

| 文件 | 说明 |
|------|------|
| `SKILL.md` | 核心技能定义：公式、示例、规则、约束、安全标记 |
| `version.txt` | `version=X.Y.Z` + `description` + `release_date: YYYY-MM-DD` + `changelog` |

安全标记格式（在 SKILL.md 顶部附近）：
```
<!-- SECURITY_MARKER: xiaoya-ai-cinema-science-protected-skill-vX.Y.Z -->
```
版本号必须与 `version.txt` 的 `version=` 一致。

> **changelog 禁止出现模型名**（MiniMax / H3 / 海螺 / 优云智算 / compshare / wan…）。
> 与 `version_science.json` 的 `notes`、`docs/releases/vx.y.z.md` 同一条纪律。

#### 步骤 2：同步辅助文件

**科普版技能是单文件结构**，zip 里只有两个成员，没有 `examples/` / `templates/`：
```
xiaoya-ai-cinema-science.zip
├── SKILL.md       （平铺，不带目录前缀）
└── version.txt
```
示例、模板都已内联进 SKILL.md，**不要**按旧文档去补 `best_practices.json` /
`README.md` / `quick-reference.md` / `MEMORY.md` —— 那些文件在当前结构里不存在。

#### 步骤 3：同步运行时规则块

文件：`D:\Story-Science\src-tauri\src\commands\writer_rules\*.md`（`chat.rs` 用 `include_str!` 内联）

装配次序是**承重结构**，不是排版：
```
SKILL.md → 【项目全局上下文】 → BLOCK_CRITICAL → BLOCK_CONSTRAINTS → BLOCK_MAPPING
                                                      ↓ 仅锚点轮
                                                   STEP_SHAPES
                                                      ↓ 仅非锚点轮
                                                   STALL_GUARD
```
> 实测：路由表排在**末尾**时正确率 12/12；排到**最前**时 0/12。改次序 = 改行为。

SKILL.md 的流程/格式变更**必须**同步到这些块（SKILL.md 的〈工作流程〉章节整体作废，
只提供写作规范）。锚点行契约 `【阶段】STEPn` / `【模式】宫格|直出` 由
`src/features/chat/stageCards.ts` 与 `writer_rules/` **两侧逐字共享**，改一侧必须同改另一侧。

#### 步骤 4：同步规则文件（如有需要）

```bash
# 主文件在 public/，构建时复制到 dist/
cd D:\Story-Science
# 编辑 public/video_gen_rules_xxx.json
# 构建时自动同步到 dist/
```

#### 步骤 5：本地验证

```bash
cd D:\Story-Science
npx tsc --noEmit                 # TS 类型检查
cd src-tauri && cargo check      # Rust 检查（改 chat.rs / writer_rules 时必做）
```

#### 步骤 6：Git 提交

```bash
cd D:\Story-Science
git add docs/skills/SKILL.md docs/skills/version.txt
git add src-tauri/src/commands/writer_rules/ src-tauri/src/commands/chat.rs   # 如改了规则块
git commit -m "chore(skill): SKILL.md vX.Y.Z — <描述>"
git push origin science-dev
```

#### 步骤 7：打包上传

**打包必须平铺 `arcname`**（Windows `Compress-Archive` 会带上目录前缀，导致解压后
变成 `xiaoya-ai-cinema-science/SKILL.md` 而客户端按平铺路径读 ⇒ 用 Python 打）：

```bash
cd D:\Story-Science\docs\skills
python -c "
import zipfile
z = zipfile.ZipFile('xiaoya-ai-cinema-science.zip','w',zipfile.ZIP_DEFLATED)
z.write('SKILL.md','SKILL.md'); z.write('version.txt','version.txt'); z.close()
"
# 校验：两个成员的 sha256 必须与磁盘文件一致
python -c "
import zipfile,hashlib
z=zipfile.ZipFile('xiaoya-ai-cinema-science.zip')
for n in z.namelist():
    a=hashlib.sha256(z.read(n)).hexdigest()
    b=hashlib.sha256(open(n,'rb').read()).hexdigest()
    print(n, 'OK' if a==b else 'MISMATCH')
"
```

上传（**先备份线上同名文件**）：
```bash
# ① 备份线上两个文件，备份名带日期
ssh root@47.108.237.10 "cd /jy/uploads/install_guide/files && \
  cp version_science.txt version_science.txt.bak.$(date +%Y%m%d) && \
  cp xiaoya-ai-cinema-science.zip xiaoya-ai-cinema-science.zip.bak.$(date +%Y%m%d)"
# ② 上传 zip
scp xiaoya-ai-cinema-science.zip root@47.108.237.10:/jy/uploads/install_guide/files/
# ③ 上传 version.txt（版本检测用；必须是包内 version.txt 的同一份字节）
scp version.txt root@47.108.237.10:/jy/uploads/install_guide/files/version_science.txt
```

#### 步骤 8：服务器验证

```bash
# 只读校验：服务器上的 version.txt 应与本地逐字一致，zip 成员版本号应正确
curl -s http://47.108.237.10/jy/uploads/install_guide/files/version_science.txt | head -5
curl -sI http://47.108.237.10/jy/uploads/install_guide/files/xiaoya-ai-cinema-science.zip | grep -i content-length
ls -l xiaoya-ai-cinema-science.zip    # 与上面的 Content-Length 比对
```

确认：文件大小一致 + `version=` 正确 + `release_date` 为当天。

### 10.4 一键打包上传（步骤 7+8 合并）

```bash
cd /d/Story-Science/docs/skills && \
python -c "
import zipfile
z = zipfile.ZipFile('xiaoya-ai-cinema-science.zip','w',zipfile.ZIP_DEFLATED)
z.write('SKILL.md','SKILL.md'); z.write('version.txt','version.txt'); z.close()
" && \
ssh root@47.108.237.10 "cd /jy/uploads/install_guide/files && cp version_science.txt version_science.txt.bak.\$(date +%Y%m%d) && cp xiaoya-ai-cinema-science.zip xiaoya-ai-cinema-science.zip.bak.\$(date +%Y%m%d)" && \
scp xiaoya-ai-cinema-science.zip root@47.108.237.10:/jy/uploads/install_guide/files/ && \
scp version.txt root@47.108.237.10:/jy/uploads/install_guide/files/version_science.txt && \
curl -s http://47.108.237.10/jy/uploads/install_guide/files/version_science.txt | head -5
```

### 10.5 关键约束

- **生产服务器**: `47.108.237.10`，上传前必须 `curl` 备份线上同名文件（`.bak.<日期>`）
- **运行时规则块是最高权威**: SKILL.md 的流程/格式变更必须同步到 `writer_rules/*.md`
- **锚点行两侧逐字共享**: `stageCards.ts` ↔ `writer_rules/`，改一侧必须同改另一侧
- **安全标记**: 与 version.txt 的 `version=` 一致
- **`version_science.txt`**: 必须与 zip 包内的 `version.txt` **逐字相同**（客户端拿它做整文件比对，
  一致就跳过、不一致就整包重下）—— 传的时候是同一个文件的两次 scp，不要手改其中一份

### 10.6 🔴 铁律：技能包不能先于客户端发布

**症状**：只传技能包、客户端还是老版本时，写手的**旧路由表**（编译在 Rust 二进制里）会
要求它在段末输出「需要生成2×3六宫格分镜图吗？A-生成 B-不生成」，而新 SKILL.md 又**明令禁止**
这类分步确认话术 ⇒ **同一轮里出现一条强制规则和一条直接冲突的禁令**，对话体验劣化甚至卡死。

**为什么老客户端会立刻吃到新技能**：`sync_post_login_tasks()` 在**每次登录**都跑
（`banana_api.rs` 里 4 处调用点），比对 version.txt 整文件不等就 `rm -rf` 重下。

**规则**：
1. **技能包与客户端版本必须同批发布** —— 先发客户端、后传技能包（或同一时刻）。
2. 传技能包之前，先在**测试账号**上确认新客户端已经装好、会话语义正常。
3. 回退 = 把 `.bak.<日期>` 原样传回；老客户端下一次登录会自动退回旧技能。

---

## 十一、故障排查

| 现象 | 可能原因 | 解决方法 |
|------|---------|---------|
| 不弹升级框 | `version_science.json` 未更新或版本号不高于当前 | 检查 JSON 文件和版本比较逻辑 |
| 下载失败 | 安装包未上传到服务器 | 检查 `downloadUrl` + 文件名是否匹配 |
| "文件校验失败" | 下载不完整，`content-length` 与实际大小不匹配 | 重新上传安装包，检查服务器是否支持 Range |
| 安装程序启动后无反应 | 旧进程未退出 | 确认 `std::process::exit(0)` 执行了 |
| 安装报错 1392 | 服务器上只有中文名安装包，缺英文名副本 | `cp 小鸭科普版_{v}_x64-setup.exe Storyboard-Science_{v}_x64-setup.exe` |
| 升级弹窗里点不到「直接下载安装」 | `notes` 过长（>300 字），按钮被顶出屏幕 | 缩短 `notes`；代码侧已限高 38vh 兜底（§八） |
| mac 用户下载 404 | `version_science.json` 提前翻了，dmg 还没 SCP 完 | 等 dmg 两次 `Content-Length` 读数一致再发 JSON（步骤 7.1） |
| 下到的 dmg 打不开 / 校验失败 | 下到了 SCP 途中的半成品 | 同上一行；已发出的把 JSON 回退到上一版本 |
| 别的行业下载按钮变成死链 | 下载页做了全局 `sed` | 从 `industry.html.bak.v{旧版本}` 恢复（§9.3） |
| 写手又开始问「A-生成 B-不生成」 | 技能包先于客户端发布了，新 SKILL 与老二进制里的旧路由表打架 | 传回 `.bak.<日期>` 的旧技能包；按 §10.6 的先发客户端、后传技能 |
| 版本号不一致 | `sync-version.mjs` 未正确执行 | 手动检查三文件的版本号 |
