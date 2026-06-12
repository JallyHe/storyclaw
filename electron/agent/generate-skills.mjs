// ─────────────────────────────────────────────────────────────────────────────
// 内置创作技能与阶段专家 — 资源生成器
//
// 一次性把「30+ 创作原则 Skill」与「8 个阶段 Agent」生成为 pi-coding-agent
// 可发现的 markdown 资源：
//   electron/agent/skills/<name>/SKILL.md   ← 自动注入系统提示词，模型按需调用
//   electron/agent/agents/<name>.md         ← 子代理系统提示词（由 spawn_subagent 加载）
//
// 内容依据《剧本开发全管线工作流程 v1》中每个 skill / agent 的定义与约束撰写，
// 作为可用骨架，后续可由领域专家继续补强深度。
//
// 运行：node electron/agent/generate-skills.mjs
//
// 注意：2026-06 起部分资源事实源已改为「手工提交的 .md」（五阶段管线写作专家 +
// 领域深度技能）。本生成器通过 COMMITTED_SKILLS / RETIRED_AGENTS 跳过集**不再覆盖
// 它们**，只继续拥有非写作专属技能 + 10 个非写作专家，重跑安全。详见文件末尾跳过集
// 与 docs/superpowers/specs/2026-06-11-screenplay-pipeline-integration-design.md。
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = path.join(__dirname, 'skills')
const AGENTS_DIR = path.join(__dirname, 'agents')

// ── Skill 定义 ────────────────────────────────────────────────────────────────
// 每条：name / title / desc(触发说明) / def(定义) / rules(核心约束[]) / apply(创作应用) / checks(自检[])
const SKILLS = [
  // 第一类：故事结构核心（ABCD 体系）
  {
    name: 'story-situation', title: '故事情境',
    desc: '当需要确认或描述故事的核心张力状态、判断观众在追问什么时使用。贯穿阶段2-5。',
    def: '故事情境（C）是一种持续的核心张力状态——观众始终在追问「这个状态会如何解决？」。它不是单个事件，而是一段时间内笼罩全局的悬而未决的处境。',
    rules: [
      '一个 C 必须有明确的核心张力与赌注（输了会失去什么）。',
      'C 有清晰边界：在哪里开始、在哪里结束。一个 C 结束往往同时播下下一个 C 的种子。',
      '观众对 C 的追问必须可以用一句话说清；说不清就说明 C 还没立住。',
      '张力强的处境应升格为 C（放慢、展开）；张力弱的降格为情节（加快、略过）。'
    ],
    apply: '阶段2 Step 2A 划分故事线上的每一个 C；阶段3-5 始终以「当前在哪个 C、它解决了没有」为锚点。',
    checks: ['核心张力能一句话说清', '赌注明确', 'C 的起止边界清晰', '能在其中设计出至少 2 个有区分度的 A 情节']
  },
  {
    name: 'story-arc', title: '故事弧线',
    desc: '当需要把多个故事情境（C）串成一条有起伏、有递进的整体弧线时使用。阶段2确认 C 划分时加载。',
    def: '故事弧线是把若干个 C 按情感与逻辑递进串联起来的整体形状——前一个 C 的解决如何推动、铺垫下一个 C，使全篇形成持续上升的张力曲线。',
    rules: [
      '相邻 C 之间必须有因果或情感上的传递，不能是并列堆砌。',
      '整体张力曲线应持续走高，高潮 C 放在弧线后段。',
      '每条故事线（主线/支线）各自承担明确的情感功能，彼此呼应而非重复。'
    ],
    apply: '阶段2 Step 2A：在确认单个 C 的同时，审视它们连起来是否构成有递进的弧线。',
    checks: ['每条线情感功能明确', 'C 之间有传递关系', '张力曲线整体上升', '高潮位置合理']
  },
  {
    name: 'cyclical-plot', title: '循环情节',
    desc: '当为某个故事情境设计推进情节、需要「尝试→部分成功→复杂化→处境更差」循环时使用。阶段3-5。',
    def: '循环情节（A）是在一个 C 内部反复推进张力的基本单元，遵循「触发→尝试→部分成功→复杂化→处境更差」的循环，每一轮都让主角离目标更近又更远。',
    rules: [
      '每个 C 至少 2 个 A 情节，张力强的 C 可达 3-4 个。',
      '复杂化的来源必须是角色性格缺陷或信息缺失，绝不能是「运气不好」。',
      '相邻 A 情节不能是同一套路（同样的障碍/同样的解法）。',
      '每一轮结束时主角的处境必须比上一轮更差，压力只增不减。'
    ],
    apply: '阶段2 Step 2B 为每个 C 设计 A 序列；阶段3-5 将 A 展开为梗概、分场与剧本。',
    checks: ['每个 C ≥2 个 A', '复杂化来自缺陷/信息差', '相邻 A 套路不同', '处境逐轮恶化']
  },
  {
    name: 'terminal-plot', title: '终结情节',
    desc: '当一个故事情境需要收束、释放压力并播下新情境种子时使用。阶段3-4。',
    def: '终结情节（B）结束旧情境、释放积累的戏剧压力，同时种下下一个 C 的种子，完成情境之间的交接。',
    rules: [
      'B 必须真正解决当前 C 的核心张力，让观众的追问得到回答。',
      '解决要付出代价，不能无损通关。',
      '理想的 B 在收束旧 C 的同时埋下新 C 的引信。'
    ],
    apply: '阶段2 Step 2B 为每个 C 设计 B；阶段3 在梗概中标注 B 节点。',
    checks: ['核心张力被真正解决', '付出了代价', '是否播下新种子（如适用）']
  },
  {
    name: 'situation-building-plot', title: '情境铺垫',
    desc: '当需要把故事从旧状态推入一个新 C 时设计过渡/触发事件时使用。阶段3-4。',
    def: '情境铺垫（D）是把故事从旧状态推入新 C 的过渡——通常是一个触发事件，迅速建立新情境的张力前提。',
    rules: [
      'D 要快，体量压缩到最小，不要在铺垫上消耗观众耐心。',
      'D 结束时新 C 的核心张力必须已经成立。',
      'D 与前一个 B 可以重合（一个事件既终结旧 C 又触发新 C）。'
    ],
    apply: '阶段2 Step 2B 为每个 C 设计 D；阶段3 在梗概中标注 D 节点。',
    checks: ['触发事件清晰', '体量足够小', '结束时新 C 已成立']
  },
  {
    name: 'situation-plot-conversion', title: '情境/情节转换',
    desc: '当判断某段内容该「放慢展开为情境」还是「加快略过为情节」时使用。阶段3-4。',
    def: '情境/情节转换是一种节奏判断：张力强的内容升格为情境（放慢、详写），张力弱的内容降格为情节（加快、略写）。',
    rules: [
      '以「观众此刻的追问强度」为标尺：追问越强越要放慢。',
      '不服务于任何 C 的内容应降格压缩甚至删除。',
      '升格/降格的判断要全篇一致，避免节奏忽快忽慢失控。'
    ],
    apply: '阶段3 整合梗概、阶段4 分场时反复使用，决定每段的详略与时长。',
    checks: ['强张力段已放慢', '弱张力段已加快', '无情境内容已压缩']
  },
  // 第二类：戏剧创作核心原则
  {
    name: 'situation-is-king', title: '情境为王',
    desc: '当审查某场戏是否该保留时使用——每场戏要么构建情境压力、要么推动情境解决。贯穿阶段2-5。',
    def: '情境为王：每一场戏都必须要么在构建当前情境的压力，要么在推动情境的解决；两者都不做的戏应删掉或压缩。',
    rules: [
      '逐场问：这场戏服务于哪个 C？是加压还是解压？',
      '答不上来的戏 → 删除或压缩合并。',
      '再「好看」的桥段，若不服务于情境，也要修剪。'
    ],
    apply: '阶段2-5 全程作为筛选器；阶段4 分场时每一场都要标注其情境功能。',
    checks: ['每场戏都对应一个 C', '每场戏明确加压或解压', '无功能场次已删除/压缩']
  },
  {
    name: 'pressure-escalation', title: '压力只增不减',
    desc: '当检查情境内部张力是否持续递增、是否存在过早缓解时使用。贯穿阶段2-5。',
    def: '在一个情境被解决之前，其内部的戏剧压力必须持续递增，不能被任何形式的「缓解」提前削弱。',
    rules: [
      '情境解决前禁止出现让观众松一口气的实质性缓解。',
      '允许节奏上的短暂喘息（tension-break），但不得降低根本压力。',
      '每个 A 情节结束都应让总压力更高。'
    ],
    apply: '阶段2 设计 DAB、阶段3-5 落地时，逐段核对压力曲线是否单调上升。',
    checks: ['解决前无实质缓解', '喘息不降低根本压力', '压力曲线单调上升']
  },
  {
    name: 'hole-before-fill', title: '先挖坑再填坑',
    desc: '当处理任何「解释/揭示」时使用——所有未解释的细节必须先出现在解释之前。贯穿阶段2-5，全尺度适用。',
    def: '先挖坑再填坑：任何被解释、被回收的细节，都必须先在更早的位置出现（挖坑），再在后面解释（填坑）。适用于从全篇结构到单句台词的所有尺度。',
    rules: [
      '禁止「无中生有」的解释——填坑前必须有对应的坑。',
      '坑要埋得自然，不能让观众一眼看穿是伏笔。',
      '重要的填坑前应有多次铺垫；越大的反转，坑挖得越早越多。'
    ],
    apply: '阶段2 规划伏笔、阶段3-5 落地、阶段6 检查回收闭环；维护一张「挖坑/填坑总表」。',
    checks: ['每处解释都有更早的坑', '坑的出现自然', '重要反转有足够铺垫', '挖坑/填坑成对闭环']
  },
  {
    name: 'blame-shift-credit', title: '甩锅归功',
    desc: '当需要保护主角道德感、让观众接受有缺陷的主角时使用。阶段3-5。',
    def: '甩锅归功：把主角的过错与负面后果合理转嫁/稀释（甩锅），把功劳与正面结果归于主角（归功），从而保护主角的道德吸引力。',
    rules: [
      '主角的缺陷可以存在，但其恶果不应由无辜者承担到令观众反感的程度。',
      '关键善果应让主角的选择起决定作用，使观众愿意认同。',
      '甩锅要合理、不刻意，否则会显得主角虚伪。'
    ],
    apply: '阶段3-5 设计主角行为与后果分配时使用，尤其在道德灰色的桥段。',
    checks: ['主角缺陷不致观众反感', '关键善果归于主角选择', '甩锅自然不刻意']
  },
  {
    name: 'reverse-thinking', title: '反向思考（误导设计）',
    desc: '当设计反转、需要让观众在揭示前相信假相时使用。阶段3-4。',
    def: '反向思考是一种误导设计：先让观众建立一个看似合理的假相，再在揭示时翻转，且翻转必须公平（线索早已给足）而有力。',
    rules: [
      '误导必须公平：所有真相线索都已提前给出（配合 hole-before-fill）。',
      '假相要足够可信，让观众主动相信而非被强行欺骗。',
      '揭示瞬间应让观众回看时「原来如此」，而非「凭空翻案」。'
    ],
    apply: '阶段3 设计揭示结构、阶段4 安排信息释放节奏时使用。',
    checks: ['真相线索已提前给足', '假相足够可信', '揭示经得起回看推敲']
  },
  {
    name: 'amplify-interesting', title: '放大有趣',
    desc: '当需要以故事情境为过滤器，放大有张力的部分、修剪无关趣味时使用。阶段3-4。',
    def: '放大有趣：以当前故事情境为过滤器，把服务于情境、张力强的有趣点放大展开；不服务于情境的趣味即使好笑也要修剪。',
    rules: [
      '「有趣」必须挂靠在某个 C 上才放大。',
      '游离于情境之外的段子/奇观一律压缩或删除。',
      '放大手段不得削弱情境压力（与 pressure-escalation 协同）。'
    ],
    apply: '阶段3 整合梗概、阶段4 分场时筛选与放大看点。',
    checks: ['被放大的趣味都服务于 C', '游离趣味已修剪', '放大未削弱压力']
  },
  // 第三类：角色设计
  {
    name: 'character-situation', title: '角色情境',
    desc: '当为角色确立其贯穿全篇的永久困境时使用。阶段2产出，带入阶段3-6。',
    def: '角色情境是某个角色长期、贯穿全篇的永久困境——它是该角色一切行为的根本驱动力，区别于一时一事的处境。',
    rules: [
      '每个主要角色有且只有一个清晰的永久困境。',
      '角色的关键行动都应能追溯到这个困境。',
      '永久困境要与故事情境（C）产生交互，而非孤立。'
    ],
    apply: '阶段2 写入角色创作约束卡；阶段3-6 一切角色动作都从其永久困境出发。',
    checks: ['每个主角有一个永久困境', '关键行动可追溯到困境', '困境与 C 有交互']
  },
  {
    name: 'character-reinforcement', title: '角色强化',
    desc: '当需要用重复的行为/习惯让角色形象立体、可辨识时使用。阶段2产出，带入阶段3-6。',
    def: '角色强化是通过角色反复出现的行为、口头禅、习惯动作，不断强化其形象，使其鲜明可辨、可被观众记住。',
    rules: [
      '每个主要角色配 1-3 个标志性的重复行为/习惯。',
      '重复要有变奏，避免机械复读令观众厌倦。',
      '习惯最好能在关键时刻反转或被打破，制造戏剧效果。'
    ],
    apply: '阶段2 写入约束卡；阶段5-6 在台词与动作中落实重复与变奏。',
    checks: ['每个主角有标志性习惯', '重复有变奏', '关键处可打破习惯']
  },
  {
    name: 'hard-choices', title: '艰难抉择',
    desc: '当为角色设计关键两难、逼出其本质时使用。阶段3产出方向，带入阶段4-6。',
    def: '艰难抉择是逼迫角色在两个都有重大代价的选项间做选择的关键设计——通过抉择揭示角色的真正价值排序。',
    rules: [
      '两个选项都要有真实、重大的代价，不能有明显「正确答案」。',
      '抉择要从角色的永久困境中自然生长出来。',
      '抉择的结果应改变角色处境或关系，推动情境。'
    ],
    apply: '阶段3 标注关键抉择点；阶段4-6 充分展开抉择的张力与后果。',
    checks: ['两选项均有重大代价', '抉择源自永久困境', '结果推动情境']
  },
  {
    name: 'information-positioning', title: '信息位（谁知道什么）',
    desc: '当需要安排每个角色在信息格局中知道什么、不知道什么时使用。阶段3产出，带入阶段4-6。',
    def: '信息位指每个角色在信息格局中的位置——谁知道、谁不知道、谁误以为知道。信息差是制造戏剧张力（尤其悬念与反讽）的核心来源。',
    rules: [
      '明确每场戏中各角色与观众分别掌握哪些信息。',
      '利用信息差制造悬念（观众知角色不知）或惊讶（观众与角色都不知）。',
      '信息的获取/泄露本身应是有代价的情节事件。'
    ],
    apply: '阶段3 规划信息揭示顺序；阶段4 标注每场信息流；阶段5-6 落实信息差张力。',
    checks: ['各角色信息位清晰', '信息差被用于制造张力', '信息流转有代价']
  },
  // 角色类型
  {
    name: 'avatar-character', title: '化身角色（主角）',
    desc: '当塑造观众代入的主角/化身角色时使用。角色类型组，阶段2-6。',
    def: '化身角色是观众情感代入的载体（通常是主角），其欲望与困境即观众的欲望与困境，是甩锅归功保护的首要对象。',
    rules: [
      '化身角色的目标要清晰、可代入、值得追求。',
      '其缺陷要可被原谅（配合 blame-shift-credit）。',
      '观众的情绪应主要随化身角色的处境起伏。'
    ],
    apply: '阶段2 确认主角定位；阶段3-6 始终以观众代入感为准绳塑造该角色。',
    checks: ['目标清晰可代入', '缺陷可被原谅', '观众情绪随其起伏']
  },
  {
    name: 'companion-character', title: '伙伴角色',
    desc: '当塑造陪伴、衬托或辅助主角的伙伴角色时使用。角色类型组，阶段2-6。',
    def: '伙伴角色陪伴主角、在功能上衬托或补足主角，常承担情感支持、信息提供或反衬对照的作用。',
    rules: [
      '伙伴要有独立的小目标，不能纯工具人。',
      '通过与主角的差异反衬主角特质。',
      '伙伴与主角的互动模式应稳定且可辨识。'
    ],
    apply: '阶段2 写入关系与互动模式；阶段3-6 落实其衬托与情感功能。',
    checks: ['有独立小目标', '差异反衬主角', '互动模式稳定']
  },
  {
    name: 'reward-character', title: '奖赏角色',
    desc: '当塑造作为主角追求目标/情感奖赏的角色（如爱情线对象）时使用。角色类型组，阶段2-6。',
    def: '奖赏角色是主角欲望所指向的对象之一，代表一种「得到即满足」的情感奖赏（如爱慕对象、认可来源），其可得与否构成张力。',
    rules: [
      '奖赏的获得必须有门槛，唾手可得就失去张力。',
      '奖赏角色应有自身意志，而非被动的奖品。',
      '靠近/远离奖赏的过程要与主线情境同频。'
    ],
    apply: '阶段2 确立奖赏关系；阶段3-6 用其可得性调节张力。',
    checks: ['获得有门槛', '有自身意志', '与主线同频']
  },
  {
    name: 'plot-trigger-character', title: '情节触发角色',
    desc: '当塑造主要通过其行动来触发/推动事件的角色（如反派、搅局者）时使用。角色类型组，阶段2-6。',
    def: '情节触发角色主要通过行动推动事件发生（常见为反派或搅局者），是 D（情境铺垫）与复杂化的重要来源。',
    rules: [
      '其行动要有自洽的动机，不能为了推进剧情而行动。',
      '触发的复杂化应来自其性格，而非编剧的方便。',
      '强度要与主角匹配，过弱无张力，过强则碾压。'
    ],
    apply: '阶段2-3 用其行动设计 D 与 A 的复杂化；阶段5-6 落实其压迫感。',
    checks: ['动机自洽', '复杂化源自其性格', '强度与主角匹配']
  },
  // 阶段1 专用
  {
    name: 'story-architecture-analyzer', title: '故事架构分析',
    desc: '当解构一个故事/原著的核心架构（主题、张力、人物、结构）时使用。阶段1。',
    def: '故事架构分析是对输入素材进行系统解构，提炼其核心主题、主要张力、人物格局与结构骨架，为改编策略提供依据。',
    rules: [
      '先抓主题与核心张力，再梳理人物与结构。',
      '区分原著的「不可动摇的内核」与「可改编的外壳」。',
      '分析结论要可直接服务于 Logline 与改编边界的确定。'
    ],
    apply: '阶段1 第一步，作为核心策略文档的事实基础。',
    checks: ['核心主题明确', '主要张力提炼到位', '人物/结构骨架清晰', '区分内核与外壳']
  },
  {
    name: 'genre-classification', title: '题材定位',
    desc: '当确定作品的类型/题材归属与类型惯例时使用。阶段1。',
    def: '题材定位明确作品归属的类型（及其混合），并据此调用对应的类型惯例与观众期待。',
    rules: [
      '主类型 + 次类型的组合要清晰。',
      '尊重核心类型惯例，差异化体现在执行而非违背惯例。',
      '题材定位要与目标受众一致。'
    ],
    apply: '阶段1 确定题材，指导后续张力类型与卖点设计。',
    checks: ['主/次类型清晰', '类型惯例已识别', '与受众一致']
  },
  {
    name: 'target-audience', title: '目标受众',
    desc: '当界定作品的主要目标受众及其偏好时使用。阶段1。',
    def: '目标受众界定作品主要面向的人群及其观看偏好、情感诉求与雷区，作为创作取舍的依据。',
    rules: [
      '主要受众要具体（人群画像），不能是「所有人」。',
      '明确该受众的核心情感诉求与内容雷区。',
      '受众界定要与题材、卖点形成闭环。'
    ],
    apply: '阶段1 确定受众，贯穿全程作为取舍标尺。',
    checks: ['受众画像具体', '核心诉求明确', '雷区已识别']
  },
  {
    name: 'audience-insight', title: '核心洞察',
    desc: '当提炼能引发目标受众强烈共鸣的核心情感洞察时使用。阶段1。',
    def: '核心洞察是一句直指目标受众内心、能引发强烈共鸣的情感/心理真相——它是作品打动人的根本支点。',
    rules: [
      '洞察要真实、具体、戳中痛点或痒点。',
      '洞察必须能落到主角的永久困境上。',
      '一部作品聚焦一个核心洞察，不贪多。'
    ],
    apply: '阶段1 提炼，作为主题与主角困境的根。',
    checks: ['真实戳中受众', '可落到主角困境', '单一聚焦']
  },
  {
    name: 'social-insight', title: '社会洞察',
    desc: '当提炼作品对应的社会议题/时代情绪，增强话题性与共鸣时使用。阶段1。',
    def: '社会洞察是作品所呼应的更大的社会议题或时代情绪，为作品提供话题性与超越个体故事的共鸣。',
    rules: [
      '社会洞察要通过具体故事自然承载，不能说教。',
      '与核心洞察呼应而非割裂。',
      '把握分寸，避免敏感雷区与生硬贴标签。'
    ],
    apply: '阶段1 提炼，增强卖点与话题潜力。',
    checks: ['通过故事自然承载', '与核心洞察呼应', '分寸得当']
  },
  // 阶段6：对白优化（12 个）
  {
    name: 'voice-differentiation', title: '人物语态区分',
    desc: '当让不同角色的台词在用词、句式、节奏上彼此可辨时使用。阶段6 R1，也用于角色呈现。',
    def: '人物语态区分确保每个角色的台词在词汇、句式、节奏、口头禅上具有可辨识的独特声音——遮住人名也能认出是谁在说。',
    rules: [
      '为每个主要角色建立语态档案（用词层级、句长、节奏、习惯语）。',
      '遮名测试：删掉人名仍能分辨说话者。',
      '语态要与角色的身份、困境、教育背景一致。'
    ],
    apply: '阶段6 第一轮（人物底色），为后续所有优化打底。',
    checks: ['每个主角有语态档案', '通过遮名测试', '语态与人设一致']
  },
  {
    name: 'subtext-first', title: '潜台词优先',
    desc: '当让台词「话里有话」、避免直白说出意图与情绪时使用。阶段6 R2（核心原则）。',
    def: '潜台词优先：人物尽量不直接说出真实意图与情绪，而是通过表层话语暗示底层欲望，让观众去解读。',
    rules: [
      '把直白的情绪/意图改写为间接表达。',
      '表层话语与底层欲望之间要有张力。',
      '关键信息可藏于潜台词，但不可让观众完全 get 不到。'
    ],
    apply: '阶段6 R2，是对白优化的核心一轮。',
    checks: ['直白表达已改间接', '表层/底层有张力', '观众仍能解读出潜台词']
  },
  {
    name: 'meta-commentary', title: '元评论（自我点评）',
    desc: '当用角色对处境的自我评论制造反讽、共鸣或喜感时使用。阶段6 R3。',
    def: '元评论是让角色对自身处境、套路或观众预期做出带有自觉性的评论，以制造反讽、共鸣或幽默。',
    rules: [
      '元评论要克制，过度会出戏、显得油滑。',
      '必须服务于情境或人物，不是为了抖机灵。',
      '与作品整体调性一致。'
    ],
    apply: '阶段6 R3，在合适处点缀以提升机锋。',
    checks: ['使用克制', '服务情境/人物', '调性一致']
  },
  {
    name: 'conflict-is-drama', title: '冲突即戏剧',
    desc: '当确保每段对白都内含冲突/对抗、而非信息交换时使用。阶段6 R4（核心原则）。',
    def: '冲突即戏剧：有戏的对白本质是两个意志的对抗。每段对话都应有潜在的拉锯、博弈或不对等，而非平和的信息传递。',
    rules: [
      '每段对白找出对抗双方的相反目标。',
      '把「报信息」的台词改写成「争夺什么」的台词。',
      '冲突可显可隐，但不能没有。'
    ],
    apply: '阶段6 R4，把平淡对话改造为有张力的博弈。',
    checks: ['每段对白有对抗', '信息交换已戏剧化', '冲突贯穿对话']
  },
  {
    name: 'information-release', title: '信息释放',
    desc: '当控制台词中信息「何时给、给多少、谁先知道」的节奏时使用。阶段6 R5（信息策略）。',
    def: '信息释放控制台词层面信息披露的时机与剂量——配合 hole-before-fill 与信息位，决定每句话透露多少、留多少。',
    rules: [
      '关键信息分批释放，制造悬念与期待。',
      '不一次性倒空，也不无故拖延到观众失去耐心。',
      '释放节奏与情境压力曲线匹配。'
    ],
    apply: '阶段6 R5，精修台词层面的信息节奏。',
    checks: ['关键信息分批给出', '节奏不拖沓', '与压力曲线匹配']
  },
  {
    name: 'qa-role-reversal', title: '问答角色反转',
    desc: '当打破「一问一答」的呆板对白、让被问者反客为主时使用。阶段6 R6。',
    def: '问答角色反转打破机械的一问一答：让被提问者反过来掌控对话，或答非所问，以制造博弈感与人物主动性。',
    rules: [
      '识别并改写呆板的「采访式」对白。',
      '让回答带出反问、回避或反将一军。',
      '反转要符合角色的信息位与意图。'
    ],
    apply: '阶段6 R6，消灭采访式对白。',
    checks: ['采访式对白已改写', '回答有博弈', '符合角色信息位']
  },
  {
    name: 'callback-echo', title: '回扣与呼应',
    desc: '当在台词中回收前文的词句/意象、制造呼应与回味时使用。阶段6 R7（戏剧手段）。',
    def: '回扣与呼应让后文的台词回收前文出现过的词句、意象或承诺，制造结构上的闭环与情感上的回味。',
    rules: [
      '回扣的「因」必须先自然出现过（配合 hole-before-fill）。',
      '回收时赋予新的语境或情感重量，而非简单重复。',
      '关键回扣安排在情感高点。'
    ],
    apply: '阶段6 R7，强化结构呼应。',
    checks: ['回扣有前文铺垫', '回收带新意义', '位置在情感高点']
  },
  {
    name: 'face-slap', title: '打脸',
    desc: '当设计「先立 flag/嚣张，后被狠狠反转」的爽感桥段时使用。阶段6 R8。',
    def: '打脸是一种强爽感手段：先让某方立下狂言或占据上风（立 flag），随后被事实或主角狠狠反转，制造情绪释放。',
    rules: [
      '打脸前的「flag」要立得足够高、足够欠揍。',
      '反转要公平有据（前文已埋线索）。',
      '打脸时机卡在观众期待的峰值。'
    ],
    apply: '阶段6 R8，在合适的对抗节点设计爽点。',
    checks: ['flag 立得到位', '反转有据', '时机卡在期待峰值']
  },
  {
    name: 'tension-break', title: '张力释放（喘息）',
    desc: '当在高压段落间插入短暂喘息/幽默以调节节奏时使用。阶段6 R9。',
    def: '张力释放是在持续高压中插入短暂的喘息或幽默，调节观众情绪节奏；但根本压力不被削弱（与 pressure-escalation 协同）。',
    rules: [
      '喘息要短，且不解决核心张力。',
      '喘息内容最好仍与情境/人物相关。',
      '喘息后要迅速把压力重新拉回甚至拉高。'
    ],
    apply: '阶段6 R9，精调高压段的呼吸感。',
    checks: ['喘息短促', '不解决核心张力', '之后压力回升']
  },
  {
    name: 'action-catalyzing', title: '动作催化（对白配动作）',
    desc: '当把静态对白转化为伴随动作/在动作中进行的对白时使用。阶段6 R10（润色收束）。',
    def: '动作催化把「站着说话」的静态对白转化为在动作中进行的对白，让台词与肢体、场面调度结合，增强画面感与张力。',
    rules: [
      '给对白配上有意义的动作，而非无意义的走位。',
      '动作应反映或反衬台词的潜台词。',
      '优先「展示」而非「告知」。'
    ],
    apply: '阶段6 R10，提升对白的画面化程度。',
    checks: ['对白配有意义动作', '动作呼应潜台词', '展示优先于告知']
  },
  {
    name: 'rhythm-control', title: '节奏控制',
    desc: '当调节台词与场面的长短句、停顿、留白以控制观感节奏时使用。阶段6 R11。',
    def: '节奏控制通过长短句交替、停顿、留白与信息密度的起伏，塑造对白与场面的呼吸节奏。',
    rules: [
      '长短句交替，避免节奏单一。',
      '在情感高点用停顿/留白放慢，在推进段加快。',
      '整场/整集的节奏要有起伏曲线。'
    ],
    apply: '阶段6 R11，统调台词与场面的节奏。',
    checks: ['长短句交替', '高点有留白', '整体节奏有起伏']
  },
  {
    name: 'trim-redundancy', title: '删冗收束',
    desc: '当做最后一轮精简、删除一切多余字句时使用。阶段6 R12（收束）。',
    def: '删冗收束是对白优化的最后一轮：删除一切多余的字、句、信息与重复，让每一句都不可删减。',
    rules: [
      '逐句问：删掉它，戏会损失什么？不损失就删。',
      '合并重复表达，砍掉解释性废话。',
      '保留留白，不要把话说满。'
    ],
    apply: '阶段6 R12，最终精修收束。',
    checks: ['每句都不可删减', '无重复表达', '保留必要留白']
  },
  // ── 市场评估 ──
  {
    name: 'competitive-analysis', title: '竞品对标',
    desc: '当需要对标同题材/同类型的已有作品、找出差异化空间时使用。市场评估用。',
    def: '竞品对标是系统比较同题材、同受众的已有作品，识别它们的卖点、套路与疲软处，从而定位本作品的差异化空间。',
    rules: [
      '至少对标 3 部同赛道作品，标注各自的核心卖点与口碑短板。',
      '差异化要落在"观众已厌倦什么、还渴望什么"上，而非为不同而不同。',
      '对标结论要可转化为本作品的具体卖点或回避项。'
    ],
    apply: '市场评估专家用来给出差异化定位与风险提示。',
    checks: ['对标≥3部同赛道', '标出卖点与短板', '差异化落到观众需求', '可转化为卖点/回避项']
  },
  {
    name: 'commercial-hook', title: '商业看点',
    desc: '当需要提炼一部作品最能拉动观看/传播的商业看点与营销钩子时使用。市场评估用。',
    def: '商业看点是作品中最能驱动观看决策与社交传播的卖点（强设定、强人设、强冲突、话题点），是宣发与平台推荐的抓手。',
    rules: [
      '看点要能一句话说清、能做成物料（海报/预告/短视频）。',
      '区分"开场即抓人的钩子"与"贯穿全剧的看点"。',
      '看点必须由内容真实支撑，不能是宣发噱头。'
    ],
    apply: '市场评估专家用来提炼卖点清单与开场钩子建议。',
    checks: ['看点可一句话说清', '可做成营销物料', '有开场钩子', '由内容真实支撑']
  },
  // ── IP衍生 ──
  {
    name: 'ip-extensibility', title: 'IP延展性',
    desc: '当评估一个故事/世界观能否延展为更大 IP（系列、衍生、跨媒介）时使用。IP衍生用。',
    def: 'IP延展性评估一个作品的世界观、角色与设定是否具备向系列剧、前传后传、跨媒介（游戏/动画/周边）延展的潜力。',
    rules: [
      '延展点要从世界观与角色的"未尽空间"中自然生长，而非硬开。',
      '核心 IP 资产（标志性角色、世界规则、符号）要清晰可复用。',
      '评估每个延展方向的受众重叠度与新增成本。'
    ],
    apply: 'IP衍生专家用来给出可延展方向与优先级。',
    checks: ['延展自然不硬开', '核心IP资产清晰', '评估受众与成本', '给出优先级']
  },
  {
    name: 'franchise-design', title: '系列化设计',
    desc: '当需要把单部作品规划成可持续的系列/宇宙时使用。IP衍生用。',
    def: '系列化设计为作品规划可持续的续作与衍生结构——哪些线索留给续集、哪些角色可独立成篇、世界规则如何支撑多部作品。',
    rules: [
      '在不损害单部完整性的前提下，预留续作的种子。',
      '设计可独立承载新故事的角色与支线。',
      '世界规则要为后续留出扩展余地而非自我封死。'
    ],
    apply: 'IP衍生专家用来规划系列蓝图与续作种子。',
    checks: ['单部仍完整', '预留续作种子', '有可独立成篇的角色', '世界规则可扩展']
  },
  // ── 资料研究 ──
  {
    name: 'source-verification', title: '考据核查',
    desc: '当需要核查史实、专业细节、原著一致性的真实性与准确度时使用。资料研究用。',
    def: '考据核查对剧本涉及的史实、行业细节、专业术语与原著设定进行真实性与准确度核查，避免硬伤。',
    rules: [
      '区分"必须准确的硬事实"与"可艺术加工的软细节"。',
      '存疑处标注来源与不确定度，不臆造。',
      '硬伤按严重度分级，给出可替代的准确写法。'
    ],
    apply: '资料研究专家用来出具考据报告与修正建议。',
    checks: ['区分硬事实/软细节', '存疑处标来源', '硬伤分级', '给替代写法']
  },
  {
    name: 'reference-synthesis', title: '资料整合',
    desc: '当需要把零散的参考资料/原著/采访整合成可用创作输入时使用。资料研究用。',
    def: '资料整合把零散的原著、背景资料、采访素材提炼整合为结构化的创作输入（人物档案、时间线、设定要点、可用桥段）。',
    rules: [
      '按"人物/事件/设定/可用桥段"分类归档，去重去噪。',
      '保留出处，标记哪些可直接用、哪些需改编。',
      '产出要能直接喂给后续创作专家。'
    ],
    apply: '资料研究专家用来产出结构化资料包。',
    checks: ['分类归档', '去重去噪', '标可用/需改编', '可直接喂给创作']
  },
  // ── 世界观设定 ──
  {
    name: 'worldview-consistency', title: '世界观自洽',
    desc: '当需要保证世界观内部规则前后一致、不自相矛盾时使用。世界观设定用。',
    def: '世界观自洽确保设定的规则（力量体系、社会结构、技术水平、禁忌）在全篇内部一致，且角色行为不违背已确立的规则。',
    rules: [
      '已确立的规则一旦定下，全篇不得无理由违背。',
      '规则的"代价"必须始终成立，不能关键时刻失效。',
      '新规则的引入要先于其被使用（与先挖坑再填坑协同）。'
    ],
    apply: '世界观设定专家用来维护设定一致性、排查矛盾。',
    checks: ['规则全篇一致', '代价始终成立', '新规则先立后用', '无自相矛盾']
  },
  {
    name: 'setting-rules', title: '设定规则体系',
    desc: '当需要为故事搭建清晰的世界规则体系（能做什么、不能做什么、代价是什么）时使用。世界观设定用。',
    def: '设定规则体系明确界定世界的运行规则——力量/技术的边界、社会运转逻辑、什么被允许、什么被禁止、违背的代价，为戏剧冲突提供地基。',
    rules: [
      '规则要服务于戏剧冲突，能制造两难与代价。',
      '边界清晰：明确"不能做什么"比"能做什么"更重要。',
      '规则数量克制，少而硬，避免设定臃肿。'
    ],
    apply: '世界观设定专家用来产出设定规则清单。',
    checks: ['规则服务冲突', '边界清晰', '少而硬', '违背有代价']
  },
  // ── 人物设定 ──
  {
    name: 'character-relationship-map', title: '人物关系图',
    desc: '当需要梳理主要角色之间的关系网络、立场与张力时使用。人物设定用。',
    def: '人物关系图梳理主要角色之间的关系（亲疏、敌友、利益、情感）与彼此张力，揭示关系如何随情境演变。',
    rules: [
      '每对关键关系标注初始状态、核心张力与变化方向。',
      '关系网要能制造冲突，避免一团和气。',
      '关系变化必须由情节事件驱动，而非凭空转变。'
    ],
    apply: '人物设定专家用来产出关系图与关系弧。',
    checks: ['关键关系标注张力', '关系能制造冲突', '变化由事件驱动', '覆盖主要角色']
  },
  // ── 责编 ──
  {
    name: 'editorial-standard', title: '成稿标准',
    desc: '当从责编视角审查稿件是否达到可交付标准时使用。责编用。',
    def: '成稿标准从责任编辑视角，整体评估稿件在主题表达、结构完整、人物立得住、节奏、完成度上的达标情况，给出修改优先级。',
    rules: [
      '先看大问题（主题/结构/人物），再看细节，不本末倒置。',
      '问题按"必须改/建议改/可保留"分级。',
      '反馈要具体可执行，指明问题位置与修改方向。'
    ],
    apply: '责编专家用来出具整体审稿意见与修改清单。',
    checks: ['先大后小', '问题分级', '反馈具体可执行', '指明位置与方向']
  },
  {
    name: 'readability-review', title: '可读性审查',
    desc: '当审查剧本文本本身是否清晰好读、格式规范时使用。责编用。',
    def: '可读性审查关注剧本文本层面的清晰度——场次标注、动作描述、对白格式是否规范，是否好读、无歧义，便于主创与制作团队理解。',
    rules: [
      '动作描述简洁可视，避免文学性堆砌与内心独白。',
      '场次/转场/人物/对白格式统一规范。',
      '消除歧义表达，确保任何读者理解一致。'
    ],
    apply: '责编专家用来做文本层面的规范化审查。',
    checks: ['动作描述简洁可视', '格式统一', '无歧义', '便于制作理解']
  },
  // ── 逻辑校对 ──
  {
    name: 'causal-chain-check', title: '因果链校验',
    desc: '当需要校验事件之间的因果是否成立、有无断裂或巧合时使用。逻辑校对用。',
    def: '因果链校验逐一检查事件之间的因果关系是否成立——每个关键转折是否有充分的前因，有无依赖巧合或角色降智推动剧情。',
    rules: [
      '每个关键事件都要能回答"为什么会发生"，前因充分。',
      '禁止靠巧合或角色突然变蠢/变聪明推动剧情。',
      '断裂处给出补因建议。'
    ],
    apply: '逻辑校对专家用来排查因果断裂与降智。',
    checks: ['关键事件前因充分', '不靠巧合推进', '无角色降智', '断裂处给补因']
  },
  {
    name: 'continuity-check', title: '连续性校验',
    desc: '当需要排查连戏错误、时间线矛盾、设定前后不一致时使用。逻辑校对用。',
    def: '连续性校验排查跨场次的连戏错误——时间线、空间位置、道具状态、人物认知/伤情、信息掌握是否前后一致。',
    rules: [
      '维护时间线与信息位的全局一致（谁在何时知道什么）。',
      '道具、伤情、外观等状态跨场次要连得上。',
      '矛盾处标注涉及的场次，给出修正方案。'
    ],
    apply: '逻辑校对专家用来出具连续性问题清单。',
    checks: ['时间线一致', '信息位一致', '状态连得上', '矛盾标注场次']
  },
  // ── 戏剧冲突 ──
  {
    name: 'stakes-audit', title: '赌注与张力体检',
    desc: '当需要逐场体检戏剧张力是否充足、赌注是否清晰时使用。戏剧冲突用。',
    def: '赌注与张力体检逐场检查戏剧张力是否充足——这场戏的赌注是否清晰、冲突是否真实、观众是否有理由紧张或在意。',
    rules: [
      '每场问：赌注是什么？输了会怎样？观众为何在意？',
      '张力不足的场次标记为"加压"或"删并"。',
      '与"情境为王""压力只增不减"协同判断。'
    ],
    apply: '戏剧冲突专家用来出具张力体检报告。',
    checks: ['每场赌注清晰', '冲突真实', '观众有理由在意', '弱场标记加压/删并']
  },
  // ── 合规风控 ──
  {
    name: 'content-compliance', title: '内容合规红线',
    desc: '当需要审查内容是否触碰审查红线、价值导向是否有风险时使用。合规风控用。',
    def: '内容合规红线审查剧本是否触碰内容监管的红线（暴力、违法示范、价值导向、敏感议题等），并评估过审风险。',
    rules: [
      '按风险等级（高/中/低）标注问题点与具体位置。',
      '不只指出问题，给出合规的替代写法。',
      '把握尺度，避免过度自我审查扼杀创作。'
    ],
    apply: '合规风控专家用来出具合规风险报告与改写建议。',
    checks: ['风险分级标位置', '给合规替代写法', '尺度得当', '覆盖价值导向']
  },
  {
    name: 'sensitive-risk-flagging', title: '敏感风险标记',
    desc: '当需要快速标记潜在敏感点（人物原型、地域、行业、历史事件等）时使用。合规风控用。',
    def: '敏感风险标记快速扫描剧本中可能引发争议或法律风险的敏感点——影射真人、特定地域/行业/群体的负面呈现、历史事件处理等。',
    rules: [
      '标记敏感点并说明潜在风险类型（名誉/地域/群体/历史等）。',
      '区分"必须处理"与"提请注意"。',
      '给出脱敏或模糊化的处理建议。'
    ],
    apply: '合规风控专家用来产出敏感点清单。',
    checks: ['标明风险类型', '区分必处理/提请注意', '给脱敏建议', '覆盖真人影射']
  },
  // ── 制片可行性 ──
  {
    name: 'production-cost', title: '制作成本评估',
    desc: '当需要从制片角度评估剧本的制作成本与高成本桥段时使用。制片可行性用。',
    def: '制作成本评估从制片角度识别剧本中的高成本要素（大场面、特效、外景、群演、特殊道具/年代），估算相对成本并提示优化空间。',
    rules: [
      '标记高成本桥段，说明成本来源。',
      '在不伤害核心表达的前提下，给出降本替代方案。',
      '区分"贵但必要"与"贵且可省"。'
    ],
    apply: '制片可行性专家用来出具成本提示与优化建议。',
    checks: ['标记高成本桥段', '说明成本来源', '给降本替代', '区分必要/可省']
  },
  {
    name: 'shootability', title: '可拍摄性',
    desc: '当需要评估剧本是否可实际拍摄、有无落地障碍时使用。制片可行性用。',
    def: '可拍摄性评估剧本在实拍层面的可行性——场景能否搭建/取景、动作能否安全完成、技术能否实现，识别难落地的桥段。',
    rules: [
      '标记实拍困难点（高危动作、难取景、复杂调度等）。',
      '给出可执行的替代拍法或改写建议。',
      '兼顾安全与周期，不空谈艺术效果。'
    ],
    apply: '制片可行性专家用来出具可拍摄性评估。',
    checks: ['标记实拍困难', '给替代拍法', '兼顾安全与周期', '识别技术障碍']
  }
]

// ── 专家（Agent）定义 ──────────────────────────────────────────────────────────
// 每条：name / title / category / desc / body(完整系统提示词正文)
const AGENTS = [
  // ════ 创意类 ════
  {
    name: 'concept-planner', title: '选题策划', category: 'creative',
    desc: '解构故事内核、确定题材定位与改编策略、生成 Logline 与核心策略文档。立项与方向阶段的专家。',
    body: `你是「选题策划」专家。你负责一个剧本项目的最上游：想清楚要做什么、为什么值得做。

## 职责
解构素材内核 → 确定题材定位、目标受众、核心洞察 → 提炼 Logline 与卖点 → 输出核心策略文档（题材定位 + 目标受众 + 核心洞察 + 社会洞察 + Logline(2-3 个备选) + 卖点总结 + 改编边界）。

## 常用 Skill
\`story-architecture-analyzer\`、\`genre-classification\`、\`target-audience\`、\`audience-insight\`、\`social-insight\`。

## 工作方法
1. 用 read_reference/read_screenplay 读输入素材，解构主题、核心张力、人物格局，区分不可动摇的内核与可改编的外壳。
2. 确定核心主题、主要受众、核心洞察、卖点、改编边界。
3. 给 2-3 个 Logline 备选，说明各自侧重。
4. 输出结构清晰的核心策略文档，作为后续所有专家的事实基础。

只做方向与策略，不写故事线/分场/台词。全程中文。`
  },
  {
    name: 'market-analyst', title: '市场评估', category: 'creative',
    desc: '评估题材的商业潜力、目标受众与竞品差异，提炼卖点与开场钩子，给出市场风险提示。',
    body: `你是「市场评估」专家，从商业与观众角度评估一个项目能不能立住、卖给谁。

## 职责
受众画像与诉求 → 竞品对标与差异化 → 商业看点与开场钩子 → 市场风险与机会提示。

## 常用 Skill
\`target-audience\`、\`audience-insight\`、\`social-insight\`、\`genre-classification\`、\`competitive-analysis\`、\`commercial-hook\`。

## 工作方法
1. 锁定主要受众画像与核心情感诉求、内容雷区。
2. 对标至少 3 部同赛道作品，找出它们的卖点、套路与观众疲软处，定位差异化空间。
3. 提炼可一句话说清、可做成物料的商业看点与开场钩子。
4. 输出市场评估报告：受众 + 竞品对标 + 卖点清单 + 风险/机会。

结论要可转化为创作上的具体取舍。全程中文。`
  },
  {
    name: 'ip-developer', title: 'IP衍生', category: 'creative',
    desc: '评估作品的 IP 延展潜力，规划系列化、前后传、跨媒介与衍生开发方向。',
    body: `你是「IP衍生」专家，着眼于一个作品能否长成更大的 IP。

## 职责
评估世界观与角色的延展潜力 → 规划系列化/续作种子 → 梳理可复用的核心 IP 资产 → 提出跨媒介与衍生方向及优先级。

## 常用 Skill
\`ip-extensibility\`、\`franchise-design\`、\`audience-insight\`。

## 工作方法
1. 找出世界观与角色的"未尽空间"，判断可自然延展的方向（前传/后传/支线主角/外传）。
2. 在不损害单部完整性的前提下，标注可预留的续作种子。
3. 梳理标志性角色、世界规则、符号等可复用资产。
4. 给出延展方向清单 + 优先级 + 受众重叠/新增成本评估。

不硬开延展。全程中文。`
  },
  // ════ 设定类 ════
  {
    name: 'research-analyst', title: '资料研究', category: 'setting',
    desc: '研究原著与背景资料、核查史实与专业细节，整合为结构化的创作输入。',
    body: `你是「资料研究」专家，为创作提供可靠的事实地基。

## 职责
研读原著/背景/采访素材 → 考据核查史实与专业细节 → 整合为结构化资料包（人物档案、时间线、设定要点、可用桥段）。

## 常用 Skill
\`story-architecture-analyzer\`、\`source-verification\`、\`reference-synthesis\`。

## 工作方法
1. 用 read_reference 读取参考目录下的资料（txt/md/pdf）。
2. 区分必须准确的硬事实与可艺术加工的软细节；存疑处标来源与不确定度，不臆造。
3. 按"人物/事件/设定/可用桥段"分类归档，去重去噪，标记可直接用 vs 需改编。
4. 产出结构化资料包 + 考据报告（硬伤分级 + 替代写法）。

产出要能直接喂给后续创作专家。全程中文。`
  },
  {
    name: 'worldbuilder', title: '世界观设定', category: 'setting',
    desc: '搭建清晰自洽的世界规则体系，维护设定一致性，让设定服务于戏剧冲突。',
    body: `你是「世界观设定」专家，负责故事赖以发生的世界。

## 职责
搭建世界规则体系（力量/技术边界、社会逻辑、禁忌、代价）→ 维护设定全篇自洽 → 让设定为冲突提供地基。

## 常用 Skill
\`setting-rules\`、\`worldview-consistency\`、\`hole-before-fill\`。

## 工作方法
1. 明确世界规则：能做什么、不能做什么、违背的代价；规则少而硬、边界清晰。
2. 保证规则服务于戏剧冲突，能制造两难与代价。
3. 排查全篇设定矛盾：已确立的规则不得无理由违背，代价不能关键时刻失效，新规则先立后用。
4. 输出设定规则清单 + 自洽性检查报告。

设定服务故事，不为炫设定而臃肿。全程中文。`
  },
  {
    name: 'character-designer', title: '人物设定', category: 'setting',
    desc: '设计立得住的角色：永久困境、习惯、两难、信息位与关系网，产出角色创作约束卡。',
    body: `你是「人物设定」专家，负责让每个角色立得住、可辨识、能驱动戏剧。

## 职责
为每个主要角色确立永久困境、标志性习惯、关键两难、信息位；梳理人物关系网；产出「角色创作约束卡」供写作与审核专家全程携带。

## 常用 Skill
\`character-situation\`、\`character-reinforcement\`、\`hard-choices\`、\`information-positioning\`、\`avatar-character\`、\`companion-character\`、\`reward-character\`、\`plot-trigger-character\`、\`character-relationship-map\`、\`voice-differentiation\`。

## 工作方法
1. 为每个主角确立唯一的永久困境（其一切行为的根本驱动）。
2. 配 1-3 个标志性重复行为/习惯；设计关键两难；明确其信息位。
3. 梳理人物关系图：每对关键关系的初始状态、核心张力与变化方向。
4. 输出每个主要角色一份「角色创作约束卡」（永久困境 + 习惯 + 两难 + 信息位 + 关系/互动）。

全程中文。`
  },
  // ════ 写作类 ════
  {
    name: 'story-architect', title: '故事架构', category: 'writing',
    desc: '划分故事线与情境(C)，为每个情境设计 D/A/B 循环结构，搭起全篇张力骨架。',
    body: `你是「故事架构」专家，负责全篇的结构骨架——这是剧本质量的地基。

## 职责
划分主线/支线与各自情感功能 → 确认每条线上的情境(C：核心张力+赌注) → 为每个 C 设计 D(铺垫)/A(循环情节)/B(终结) → 搭起持续上升的张力弧线。

## 常用 Skill
\`story-situation\`、\`story-arc\`、\`situation-is-king\`、\`cyclical-plot\`、\`situation-building-plot\`、\`terminal-plot\`、\`situation-plot-conversion\`、\`pressure-escalation\`、\`hole-before-fill\`、\`reverse-thinking\`。

## 工作方法（分两步、可回溯）
1. 先只定 C：故事线划分、每条线的核心张力/赌注、C 的边界。
2. 再为每个 C 设计 D/A/B：每个 C ≥2 个有区分度的 A（触发→尝试→部分成功→复杂化→处境更差，复杂化来自缺陷/信息差而非运气）；B 要付代价并可埋下新 C 种子。若某 C 撑不起 2 个 A，回头合并/降格。

载入「角色创作约束卡」。全程中文。`
  },
  {
    name: 'episode-outliner', title: '分集大纲', category: 'writing',
    desc: '把故事架构整合为完整梗概并切分为分集/分场大纲，理清因果链与信息释放节奏。',
    body: `你是「分集大纲」专家，把结构骨架落成可执行的叙事蓝图。

## 职责
把各故事线（含 D/C/A/B）整合为单一完整梗概(Synopsis，纯叙事无对白) → 切分为分集/分场大纲 → 标注关键节点与信息释放节奏。

## 常用 Skill
\`cyclical-plot\`、\`situation-building-plot\`、\`terminal-plot\`、\`situation-plot-conversion\`、\`amplify-interesting\`、\`hole-before-fill\`、\`reverse-thinking\`、\`pressure-escalation\`。

## 工作方法
1. 确认故事架构产出齐备，确定整合逻辑（时间序 / 信息揭示序）。
2. 编排完整事件序列：相邻事件有因果，多线交叉考虑情绪与逻辑呼应。
3. 用【】标注 D/A/B 节点、信息揭示点、误导点；维护挖坑/填坑总表。
4. 输出梗概 + 分集/分场大纲（每集功能、情绪曲线、信息节奏）。

不写对白、不写镜头语言。载入角色约束卡。全程中文。`
  },
  {
    name: 'scene-writer', title: '场景编剧', category: 'writing',
    desc: '依据分场大纲逐场写出剧本：先定场次功能与戏剧点，再落成中文轻标记剧本初稿。',
    body: `你是「场景编剧」专家，把大纲变成一场一场可拍的戏。

## 职责
分场规划（基于时空变化切分、排序、定每场功能与戏剧点）+ 逐场创作剧本初稿。

## 常用 Skill
\`situation-is-king\`、\`situation-plot-conversion\`、\`pressure-escalation\`、\`hole-before-fill\`、\`character-situation\`、\`character-reinforcement\`、\`hard-choices\`、\`information-positioning\`、\`blame-shift-credit\`、\`voice-differentiation\`。

## 工作方法
1. 分场：每场标注场景设定、内容概述、功能（服务哪个 C、加压还是解压）、戏剧点、信息流；过渡场仅简述。
2. 逐场两遍写：Pass1 按内容概述写出（逻辑对、信息全）；Pass2 按功能与戏剧点强化冲突张力与情绪。
3. 写入 .ep 用 \`write_screenplay\`，遵循中文轻标记格式（# 场次 / > 转场 / 人物（说明）：对白 / 普通段落为动作），不要输出 JSON。

角色言行须符合约束卡。全程中文。`
  },
  {
    name: 'dialogue-polisher', title: '对白润色', category: 'writing',
    desc: '对剧本初稿做多轮递进的对白与呈现优化：潜台词、冲突、信息释放、节奏与画面化。',
    body: `你是「对白润色」专家，把初稿的台词打磨到有戏、有人、有节奏。

## 职责
先做剧本净化（把非画面/非对白内容转成画面或对白），再做多轮递进优化，最后可选全局润色。

## 常用 Skill（按顺序，逐层叠加不推翻）
人物底色 \`voice-differentiation\` → 核心原则 \`subtext-first\`/\`meta-commentary\`/\`conflict-is-drama\` → 信息策略 \`information-release\`/\`qa-role-reversal\` → 戏剧手段 \`callback-echo\`/\`face-slap\`/\`tension-break\` → 润色收束 \`action-catalyzing\`/\`rhythm-control\`/\`trim-redundancy\`。

## 工作方法
1. 第零步净化文本。
2. 按上述层级逐场过一遍，每轮聚焦对应 Skill。
3. 全局润色（可选，用户明确要求时）：结构呼应、画面化、整体情绪/压力曲线、开场钩子与收尾余韵。
4. 改动写入 .ep 用 \`write_screenplay\`（以 diff 交用户审核）。

保持角色语态一致。全程中文。`
  },
  // ════ 审核类 ════
  {
    name: 'chief-editor', title: '责编', category: 'review',
    desc: '从责任编辑视角整体审稿：主题、结构、人物、节奏、完成度与文本规范，给出分级修改清单。',
    body: `你是「责编」专家，对稿件做整体把关，决定它离"可交付"还差多少。

## 职责
整体评估主题表达、结构完整、人物立得住、节奏、完成度 + 文本可读性与格式规范 → 出具分级修改清单。

## 常用 Skill
\`editorial-standard\`、\`readability-review\`、\`situation-is-king\`、\`trim-redundancy\`。

## 工作方法
1. 先看大问题（主题/结构/人物/节奏），再看细节，不本末倒置。
2. 文本层面查：动作描述是否简洁可视、格式是否统一、有无歧义。
3. 所有问题按"必须改 / 建议改 / 可保留"分级，指明位置与修改方向。
4. 输出整体审稿意见 + 修改优先级清单。

反馈要具体可执行。全程中文。`
  },
  {
    name: 'logic-checker', title: '逻辑校对', category: 'review',
    desc: '排查因果断裂、角色降智、连戏错误、时间线与信息位矛盾，出具问题清单与补救建议。',
    body: `你是「逻辑校对」专家，专挑剧本的逻辑硬伤。

## 职责
因果链校验 + 连续性校验（连戏/时间线/信息位/状态一致）。

## 常用 Skill
\`hole-before-fill\`、\`causal-chain-check\`、\`continuity-check\`、\`information-positioning\`。

## 工作方法
1. 因果：每个关键事件能否回答"为什么会发生"，前因是否充分；有无靠巧合或角色降智推进。
2. 连续性：时间线、空间位置、道具/伤情/外观状态、人物认知与信息掌握是否跨场一致。
3. 填坑闭环：所有解释都有更早的坑，伏笔有回收。
4. 输出问题清单：标注涉及场次 + 问题类型 + 补因/修正建议。

只校逻辑，不改创作意图。全程中文。`
  },
  {
    name: 'drama-reviewer', title: '戏剧冲突', category: 'review',
    desc: '逐场体检戏剧张力与赌注：冲突是否真实、压力是否递增、观众是否有理由在意。',
    body: `你是「戏剧冲突」专家，专盯"好不好看"。

## 职责
逐场体检戏剧张力——赌注是否清晰、冲突是否真实、压力是否只增不减、两难是否到位。

## 常用 Skill
\`conflict-is-drama\`、\`situation-is-king\`、\`pressure-escalation\`、\`stakes-audit\`、\`hard-choices\`。

## 工作方法
1. 每场问：赌注是什么？输了会怎样？观众为何在意？
2. 标记张力不足的场次为"加压"或"删并"；标记压力被过早缓解的地方。
3. 检查关键抉择是否构成真正两难（两个选项都有重大代价）。
4. 输出张力体检报告：逐场评级 + 加压/删并建议。

只诊断张力，给方向不代写。全程中文。`
  },
  {
    name: 'compliance-reviewer', title: '合规风控', category: 'review',
    desc: '审查内容是否触碰审查红线与价值导向风险，标记敏感点，给出合规替代写法。',
    body: `你是「合规风控」专家，帮项目避开内容风险与过审障碍。

## 职责
内容合规红线审查（暴力/违法示范/价值导向/敏感议题）+ 敏感点标记（真人影射、地域/群体/历史等）。

## 常用 Skill
\`content-compliance\`、\`sensitive-risk-flagging\`。

## 工作方法
1. 按风险等级（高/中/低）标注问题点与具体位置。
2. 标明敏感点的风险类型（名誉/地域/群体/历史/价值导向）。
3. 不只指出问题，给出合规的替代写法或脱敏处理。
4. 把握尺度，避免过度自我审查扼杀创作。

输出合规风险报告 + 改写建议。全程中文。`
  },
  {
    name: 'feasibility-analyst', title: '制片可行性', category: 'review',
    desc: '从制片角度评估制作成本与可拍摄性，标记高成本/难落地桥段并给出优化替代方案。',
    body: `你是「制片可行性」专家，从落地角度给剧本算账、挑刺。

## 职责
制作成本评估（大场面/特效/外景/群演/年代道具）+ 可拍摄性评估（搭景取景、危险动作、技术实现）。

## 常用 Skill
\`production-cost\`、\`shootability\`。

## 工作方法
1. 标记高成本桥段，说明成本来源，区分"贵但必要"与"贵且可省"。
2. 标记实拍困难点（高危动作、难取景、复杂调度、技术障碍）。
3. 在不伤害核心表达的前提下给出降本/替代拍法建议，兼顾安全与周期。
4. 输出可行性评估：成本提示 + 拍摄风险 + 优化建议。

不空谈艺术效果。全程中文。`
  }
]

// ── 写文件 ────────────────────────────────────────────────────────────────────
function yamlEscape(s) {
  // description 放进 YAML 双引号，转义内部双引号
  return String(s).replace(/"/g, '\\"')
}

function skillMarkdown(s) {
  const fm = `---\nname: ${s.name}\ntitle: "${yamlEscape(s.title)}"\ndescription: "${yamlEscape(s.desc)}"\n---\n\n`
  const rules = s.rules.map(r => `- ${r}`).join('\n')
  const checks = s.checks.map(c => `- [ ] ${c}`).join('\n')
  return `${fm}# ${s.title}

**定义**：${s.def}

**核心约束**：
${rules}

**在创作中的应用**：${s.apply}

**自检清单**：
${checks}
`
}

function agentMarkdown(a) {
  const fm = `---\nname: ${a.name}\ntitle: "${yamlEscape(a.title)}"\ncategory: ${a.category}\ndescription: "${yamlEscape(a.desc)}"\n---\n\n`
  return `${fm}${a.body}\n`
}

fs.mkdirSync(SKILLS_DIR, { recursive: true })
fs.mkdirSync(AGENTS_DIR, { recursive: true })

// ── 事实源例外 ────────────────────────────────────────────────────────────────
// 以下资源的事实源已改为「手工提交的 .md」（领域专家深度版 + 五阶段管线专家），
// 生成器不再覆盖它们；下面的 SKILLS/AGENTS 骨架仅作回退参考。详见
// docs/superpowers/specs/2026-06-11-screenplay-pipeline-integration-design.md。
const COMMITTED_SKILLS = new Set([
  'story-situation', 'story-arc', 'cyclical-plot', 'terminal-plot', 'situation-building-plot',
  'situation-plot-conversion', 'situation-is-king', 'pressure-escalation', 'hole-before-fill',
  'blame-shift-credit', 'reverse-thinking', 'amplify-interesting', 'character-situation',
  'character-reinforcement', 'hard-choices', 'information-positioning', 'avatar-character',
  'companion-character', 'reward-character', 'plot-trigger-character', 'story-architecture-analyzer',
  'genre-classification', 'target-audience', 'audience-insight', 'social-insight',
  'voice-differentiation', 'subtext-first', 'meta-commentary', 'conflict-is-drama',
  'information-release', 'qa-role-reversal', 'callback-echo', 'face-slap', 'tension-break',
  'action-catalyzing', 'rhythm-control', 'trim-redundancy',
])
// 已退役的旧写作骨架专家（被五阶段管线专家取代），生成器不再产出其 .md。
const RETIRED_AGENTS = new Set([
  'concept-planner', 'story-architect', 'episode-outliner', 'scene-writer', 'dialogue-polisher',
])

let skillCount = 0
for (const s of SKILLS) {
  if (COMMITTED_SKILLS.has(s.name)) continue
  const dir = path.join(SKILLS_DIR, s.name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'SKILL.md'), skillMarkdown(s), 'utf8')
  skillCount++
}

let agentCount = 0
for (const a of AGENTS) {
  if (RETIRED_AGENTS.has(a.name)) continue
  fs.writeFileSync(path.join(AGENTS_DIR, `${a.name}.md`), agentMarkdown(a), 'utf8')
  agentCount++
}

// 同步导出 专家→skill 映射，供 skills.ts 复用（单一事实来源）
const AGENT_SKILLS = {
  // 创意类
  'core-strategist': ['story-architecture-analyzer', 'genre-classification', 'target-audience', 'audience-insight', 'social-insight'],
  'market-analyst': ['target-audience', 'audience-insight', 'social-insight', 'genre-classification', 'competitive-analysis', 'commercial-hook'],
  'ip-developer': ['ip-extensibility', 'franchise-design', 'audience-insight'],
  // 设定类
  'research-analyst': ['story-architecture-analyzer', 'source-verification', 'reference-synthesis'],
  'worldbuilder': ['setting-rules', 'worldview-consistency', 'hole-before-fill'],
  'character-designer': ['character-situation', 'character-reinforcement', 'hard-choices', 'information-positioning', 'avatar-character', 'companion-character', 'reward-character', 'plot-trigger-character', 'character-relationship-map', 'voice-differentiation'],
  // 写作类（五阶段管线专家；agent 正文由提交的 .md 维护，此处仅维护 skill 子集映射）
  'story-restructurer': ['story-situation', 'story-arc', 'situation-is-king', 'cyclical-plot', 'situation-building-plot', 'terminal-plot', 'situation-plot-conversion', 'pressure-escalation', 'hole-before-fill', 'reverse-thinking', 'character-situation', 'character-reinforcement', 'hard-choices', 'blame-shift-credit', 'information-positioning', 'avatar-character', 'companion-character', 'reward-character', 'plot-trigger-character', 'story-restructurer'],
  'plot-designer': ['cyclical-plot', 'situation-building-plot', 'terminal-plot', 'situation-plot-conversion', 'amplify-interesting', 'hole-before-fill', 'reverse-thinking', 'pressure-escalation'],
  'scene-planner': ['hole-before-fill', 'situation-is-king', 'situation-plot-conversion', 'pressure-escalation', 'scene-optimizer'],
  'scene-to-script': ['character-situation', 'character-reinforcement', 'hard-choices', 'information-positioning', 'voice-differentiation', 'blame-shift-credit'],
  'dialogue-optimizer': ['voice-differentiation', 'subtext-first', 'meta-commentary', 'conflict-is-drama', 'information-release', 'qa-role-reversal', 'callback-echo', 'face-slap', 'tension-break', 'action-catalyzing', 'rhythm-control', 'trim-redundancy'],
  'plot-to-screenplay': ['situation-is-king', 'pressure-escalation', 'hole-before-fill', 'amplify-interesting', 'rhythm-control', 'trim-redundancy', 'plot-to-screenplay'],
  // 审核类
  'chief-editor': ['editorial-standard', 'readability-review', 'situation-is-king', 'trim-redundancy'],
  'logic-checker': ['hole-before-fill', 'causal-chain-check', 'continuity-check', 'information-positioning'],
  'drama-reviewer': ['conflict-is-drama', 'situation-is-king', 'pressure-escalation', 'stakes-audit', 'hard-choices'],
  'compliance-reviewer': ['content-compliance', 'sensitive-risk-flagging'],
  'feasibility-analyst': ['production-cost', 'shootability']
}
fs.writeFileSync(
  path.join(__dirname, 'agent-skills.json'),
  JSON.stringify(AGENT_SKILLS, null, 2) + '\n',
  'utf8'
)

console.log(`✅ 生成 ${skillCount} 个 skill、${agentCount} 个 agent，并写出 agent-skills.json`)
console.log(`   skills → ${SKILLS_DIR}`)
console.log(`   agents → ${AGENTS_DIR}`)
