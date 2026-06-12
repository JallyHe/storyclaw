---
name: screenplay-director
title: "剧本流程总管"
description: "把一段 IP 材料按五阶段流程推进到最终剧本的编排配方。当用户说\"按流程开发剧本\"\"全流程创作\"\"从 IP 开始做剧本\"\"一条龙做剧本\"时加载，由主会话按需派发各阶段专家、在每阶段末设人工确认点。"
---

# 剧本流程总管（编排配方）

这是一份**给主会话用的编排配方**：当用户想把一段 IP 材料（小说/梗概/已有剧本）一路推进到最终剧本时，按下面五个阶段顺序，用 `spawn_subagent` 调用对应的阶段专家，每个阶段结束后**把产出展示给用户、等用户确认**再进入下一阶段。

> 这不是强制管线。用户可以随时打断、跳过讨论、从中途阶段切入，或只单独调用某个专家。本配方只规定「想跑全流程时」的推荐顺序与交接。

## 关键约束

- **状态靠主会话转述**：阶段专家是隔离子代理、彼此无记忆。每次 `spawn_subagent` 的 `task` 里必须**完整带上**所需的前序产出（尤其阶段2产出的「角色创作约束卡」要在阶段3-5全程携带）。
- **人工确认点由主会话承担**：子代理不能问用户。每阶段产出后，由你（主会话）用 `AskUserQuestion` 或直接征询用户「满意 / 需修改」。不满意则带着反馈重新派发该阶段专家。

## 五阶段流程

```
阶段0 项目启动     确认输入材料、改编范围、目标形式与篇幅、已有中间产出
  ↓
阶段1 核心策略     spawn_subagent → core-strategist        产出：Logline + 核心策略文档
  ↓ 确认
阶段2 故事框架     spawn_subagent → story-restructurer     产出：故事脉络 + 角色关系图 + 角色约束卡
  ↓ 确认
阶段3 情节填充     spawn_subagent → plot-designer          产出：故事大纲 Synopsis（无对白）
  ↓ 确认
阶段4 剧本创作     spawn_subagent → scene-planner          产出：分场创作指导
                  spawn_subagent → scene-to-script        产出：剧本初稿
  ↓ 确认
阶段5 优化美化     spawn_subagent → dialogue-optimizer     产出：对白优化版
                  spawn_subagent → plot-to-screenplay     产出：最终版剧本（5B 可选）
  ↓ 确认
最终输出：最终版剧本
```

## 各阶段交接要点

- **阶段1 → 2**：把核心策略文档（题材定位 / 目标受众 / 核心洞察 / Logline / 改编边界）完整转给 story-restructurer。
- **阶段2 → 3**：把故事脉络（各故事线的 C 与每个 C 的 D/A/B）、角色关系图、**角色约束卡**完整转给 plot-designer。
- **阶段3 → 4A**：把 Synopsis 转给 scene-planner。
- **阶段4A → 4B**：把分场创作指导转给 scene-to-script；约束卡随行。
- **阶段4 → 5A**：把剧本初稿 + 约束卡转给 dialogue-optimizer。
- **阶段5A → 5B**：把对白优化版转给 plot-to-screenplay（若 5A 已满足要求，可跳过 5B）。

## 阶段速查表

| 阶段 | 专家 | 主要 Skill |
|------|------|-----------|
| 1 核心策略 | `core-strategist` | story-architecture-analyzer / genre-classification / target-audience / audience-insight / social-insight |
| 2 故事框架 | `story-restructurer` | story-situation / story-arc / situation-is-king / cyclical-plot / situation-building-plot / terminal-plot / situation-plot-conversion / pressure-escalation / hole-before-fill / reverse-thinking + 角色塑造组 |
| 3 情节填充 | `plot-designer` | cyclical-plot / situation-building-plot / terminal-plot / situation-plot-conversion / amplify-interesting / hole-before-fill / reverse-thinking / pressure-escalation |
| 4 剧本创作 | `scene-planner` → `scene-to-script` | hole-before-fill / situation-is-king / situation-plot-conversion / pressure-escalation → character-situation / character-reinforcement / hard-choices / information-positioning |
| 5 优化美化 | `dialogue-optimizer` → `plot-to-screenplay` | 12 个对白优化 Skill（voice-differentiation → trim-redundancy）→ 叙事节奏与文笔润色 |

## 中途接手

用户已有某阶段产出时，从对应阶段切入，但先确认该阶段的前置输入齐备：
- 从阶段2进入 → 先要核心策略文档
- 从阶段3进入 → 先要故事脉络 + 角色约束卡
- 从阶段4进入 → 先要 Synopsis
- 从阶段5进入 → 先要剧本初稿
