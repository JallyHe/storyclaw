# 编辑器查找/替换功能设计

**日期**：2026-06-03  
**范围**：大纲（MD）、剧本（EP）、TXT、DOCX、PDF

---

## 1. 目标

为所有编辑器类型添加 `Ctrl+F` 页面内查找功能；对可编辑类型（MD / EP / TXT）额外支持替换。

---

## 2. 核心接口

```ts
interface FindOptions {
  caseSensitive: boolean
}

interface FindHandlers {
  find(query: string, options: FindOptions): number  // 返回总匹配数
  prev(): void
  next(): void
  replace?(replacement: string): void
  replaceAll?(query: string, replacement: string, options: FindOptions): number
  clear(): void  // 关闭时清理高亮
}
```

---

## 3. 数据流

```
Ctrl+F
→ DocumentEditorShell 拦截 keydown（preventDefault）
→ showFindBar = true，渲染浮层 <FindBar>
→ 用户输入查询词
→ FindBar 调用 findHandlers.find(query, options)
→ 编辑器高亮并滚动到首个匹配
→ FindBar 显示 "N / M"
→ Esc → findHandlers.clear() + showFindBar = false，焦点回编辑器
```

---

## 4. 新增组件

### 4.1 `FindBar`（`src/components/editors/FindBar.tsx`）

- 绝对定位浮层，`position: absolute; top: 8px; right: 8px; z-index: 200`
- 包含：查询输入框、`Aa` 区分大小写切换、上一个 / 下一个按钮、匹配计数（`N / M`）
- `allowReplace=true` 时展示替换输入框 + 替换 / 全部替换按钮
- 无匹配时查询框显示红色边框

**Props**：
```ts
interface FindBarProps {
  handlers: FindHandlers
  allowReplace: boolean
  onClose: () => void
}
```

---

## 5. `DocumentEditorShell` 改动

新增 prop：
```ts
findHandlers?: FindHandlers
```

- 当 `findHandlers` 存在时，在 `doc-shell-canvas` 上监听 `keydown`，拦截 `Ctrl+F` / `Cmd+F`
- 内部维护 `showFindBar: boolean` 状态
- 在 `doc-shell-canvas`（`position: relative`）内渲染 `<FindBar>`
- `Ctrl+H` 打开并自动展开替换行

---

## 6. 各编辑器实现

### 6.1 PlainTextEditor（TXT）—— 支持替换

- 维护 `matches: Array<{start, end}>` 和 `currentIndex`
- `find()`: 遍历字符串收集所有偏移，`textarea.setSelectionRange(start, end)` 高亮并滚动
- `replace()`: `text.slice(0, start) + replacement + text.slice(end)`，触发自动保存
- `replaceAll()`: 全字符串替换，触发自动保存
- `clear()`: 重置 `matches = []`，取消选区

### 6.2 OutlineEditor（MD）—— 支持替换

- `RichTextEditorHandle` 新增 `findInEditor(query, options)` / `replaceMatch()` / `replaceAllMatches()` / `clearHighlights()` 方法
- 遍历 ProseMirror view DOM 的文本节点，收集匹配的 DOM range
- 注入 `<span class="find-highlight">` / `<span class="find-highlight-current">` 标记
- `replace()`: 通过 ProseMirror `tr.replaceWith()` 事务修改文档，替换后重新执行 `find()`
- `clear()`: 移除所有注入的 `<span>`，恢复原始文本节点

### 6.3 ScreenplayProseMirrorEditor（EP）—— 支持替换

- 与 OutlineEditor 方案相同，基于 ProseMirror view DOM 文本节点遍历
- `replace()` 通过 ProseMirror 事务操作，替换后重新执行 `find()`
- `clear()` 移除高亮 span

### 6.4 RefViewer（PDF）—— 仅查找，不支持替换

- `FindBar` 在 `RefViewer` 内部独立实现（不经过 `DocumentEditorShell`）
- `find()`: 并行调用 `page.getTextContent()` 收集各页文本，构建匹配页码列表
- `next()` / `prev()`: 调用已有 `goToPage()` 跳转
- 计数显示"第 X 页（共 Y 处匹配）"，不高亮 canvas 内容
- 等待 `pdfDoc` 就绪后才执行搜索

### 6.5 RefViewer（DOCX）—— 仅查找，不支持替换

- `FindBar` 在 `RefViewer` 内部独立实现
- `find()`: 遍历 `docxRef.current` 的所有 `Text` 节点，用 `splitText` + 包裹 `<mark class="find-highlight">` 高亮
- `next()` / `prev()`: 切换 `find-highlight-current` class，`scrollIntoView`
- `clear()`: 把所有 `<mark>` unwrap，恢复原始 `Text` 节点

---

## 7. 键盘快捷键

| 快捷键 | 行为 |
|--------|------|
| `Ctrl+F` / `Cmd+F` | 打开查找栏 |
| `Ctrl+H` | 打开查找栏并展开替换行（仅可编辑类型） |
| `Enter` / `F3` | 下一个匹配 |
| `Shift+Enter` / `Shift+F3` | 上一个匹配 |
| `Escape` | 关闭查找栏，清除高亮 |

---

## 8. 边界情况

- 查询词为空 → 不搜索，计数显示空
- 无匹配 → 输入框红色边框，显示 `0 / 0`
- 查询词变化 → 重新执行 `find()`，`currentIndex` 重置为 0
- 文件切换 → `clear()` 自动调用，查找栏关闭
- PDF 尚未完成渲染 → 等待 `pdfDoc` 就绪后执行搜索
- ProseMirror 替换后 → 重新执行 `find()` 更新匹配列表

---

## 9. 文件变更清单

| 文件 | 变更类型 |
|------|----------|
| `src/components/editors/FindBar.tsx` | 新增 |
| `src/components/editors/DocumentEditorShell.tsx` | 修改（新增 `findHandlers` prop + FindBar 渲染） |
| `src/components/editors/text/PlainTextEditor.tsx` | 修改（实现 `FindHandlers`） |
| `src/components/editors/outline/OutlineEditor.tsx` | 修改（实现 `FindHandlers`） |
| `src/components/editors/prosemirror/RichTextEditor.tsx` | 修改（新增 handle 方法） |
| `src/components/editors/prosemirror/ScreenplayProseMirrorEditor.tsx` | 修改（实现 `FindHandlers`） |
| `src/components/editors/reference/RefViewer.tsx` | 修改（内置 FindBar + PDF/DOCX 搜索） |
| `src/styles/globals.css` 或 `prosemirror.css` | 修改（高亮样式 `.find-highlight`） |
