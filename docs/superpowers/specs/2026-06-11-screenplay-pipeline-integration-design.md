# 五阶段剧本管线集成进 StoryClaw 运行时 — 设计

日期：2026-06-11

## 背景

用户提供两个压缩包（`skills.rar` / `agents.rar`）与一个 `script-pipeline-director.md`，内容是「五阶段剧本创作管线」的深度版资源（Claude Code 原生 subagent 格式）。要求：加入 StoryClaw 系统；与现有同名资源冲突时优先用新文件；并做一轮检查优化。

新资源 = 11 天前集成时所写「骨架」的领域专家补强版（记忆 `script-pipeline-integration` 预告过）。

## 三类零件 → StoryClaw 运行时的映射

StoryClaw 运行时只有两种资源：**Skill**（pi 原生，`additionalSkillPaths` 自动注入，按需调用）与 **Agent**（`spawn_subagent` 派发的隔离子代理，不能嵌套 spawn、不能问用户）。

| 管线零件 | 映射 | 说明 |
|---|---|---|
| 40 个创作原则 | **Skill**（committed `.md`） | 覆盖 37 个同名骨架 + 新增 plot-to-screenplay / scene-optimizer / story-restructurer |
| 7 个阶段写作专家 | **Agent 子代理** | core-strategist / story-restructurer / plot-designer / scene-planner / scene-to-script / dialogue-optimizer / plot-to-screenplay |
| director 总管 | **Skill（主会话读）** | 子代理不能 spawn/问用户 → 编排只能由主会话承担；做成 opt-in 的「流程配方」技能 `screenplay-director`，去掉 "pipeline" 命名 |

## 班子取舍（已与用户确认由我拍板）

- **替换** 5 个写作骨架专家：concept-planner / story-architect / episode-outliner / scene-writer / dialogue-polisher。
- **保留** 10 个非写作专家：market-analyst / ip-developer / research-analyst / worldbuilder / character-designer / chief-editor / logic-checker / drama-reviewer / compliance-reviewer / feasibility-analyst。
- 最终 **17 专家 + 1 director 技能**。理由：两套近似写作专家会让主模型派发犯迷糊。

## 实现机制

- 富文本资源的事实源改为**直接提交的 `.md`**；`generate-skills.mjs` 不再生成这 40 技能 + 7 写作专家（用 `COMMITTED_*` 跳过集），避免重跑覆盖。
- 生成器继续拥有 18 个「非写作专属技能」+ 10 个非写作专家。
- 子代理隔离约束：每个新 agent 正文顶部注入统一「运行时说明」横幅（无法问用户/spawn，待确认项写入产出交主会话转述）。

## 需要同步修改的触点

1. `electron/agent/skills/*` — 覆盖/新增 40 个 SKILL.md（注入 `title`）
2. `electron/agent/agents/*` — 新增 7 个（注入 `title`/`category`，去 model/color/tools），删 5 个
3. `electron/agent/skills/screenplay-director/SKILL.md` — 新建 director 技能
4. `electron/agent/skills.ts` — `AGENT_NAMES`、文件标记 map、prompt 文案
5. `electron/agent/runtime.ts` — 系统提示词中的专家清单
6. `electron/agent/generate-skills.mjs` — `AGENTS`/`AGENT_SKILLS`/跳过集
7. `electron/agent/agent-skills.json` — 重新生成（17 键）
8. `src/hooks/useAgentEvents.ts` — 专家显示名 map
9. `tests/agent-skills.test.ts` — `DISPATCHABLE` 列表

## 优化轮

修复新技能里指向不存在技能的 `[[wikilink]]`（如 `synopsis-only`）；校验 `agent-skills.json` 引用的技能都在盘；统一注入子代理运行时横幅；跑 `tests/agent-skills.test.ts` 全绿。
