import { invoke } from '@tauri-apps/api/core';

export interface IntegrationRules {
  model: string;
  max_tokens: number;
  system_prompt: string;
}

export interface VideoGenConstraints {
  global_rule: string;
  spatial_anchor?: string;
  physics_rule?: string;
  facing_lock?: string;
  axis_lock?: string;
  landmark_lock?: string;
  spatial_progression?: string;
  pose_lock?: string;
  prop_lock?: string;
  anti_hallucination?: string;
  physics_law?: string;
  shot_cutting?: string;
  object_persistence?: string;
  motion_catalog: string;
  shot_continuity: string;
  hard_constraints: string[];
}

export interface VideoGenRules {
  version: string;
  integration: IntegrationRules;
  constraints: VideoGenConstraints;
  /** 负面提示词，用于视频生成质量过滤 */
  negative_prompt?: string;
  /** 注入到提示词前面的规则文本（所有模型通用） */
  prompt_rule?: string;
  /** CFG scale，控制生成与提示词的匹配度 */
  guidance_scale?: number;
  /** 镜头模式：single 单镜头 / multi 多镜头 */
  shot_type?: string;
}

// 科普版兜底规则 — 仅网络故障时使用。完整规则见服务端 video_gen_rules_minimax_h3.json
const DEFAULT_PROMPT_RULE = '【核心指令】参考图是 6 宫格故事板，生成一段连续、带运镜的科普短视频。宫格 1→2→3→4→5→6 是一条连续时间线，不是 6 张独立快照拼接的幻灯片。科学主体/场景/光影跨宫格完全一致，动态过程从前一格自然延续到后一格，无跳跃、无重置、无时间倒流。\n\n【故事板=唯一视觉真相】画面内容 100% 来自参考图宫格，文本只写运镜+动作+声音，禁止添加参考图不存在的科学主体/物品/道具/背景，禁止改写参考图已有内容。\n\n【自然语言运镜】用中文自然语言描述摄像机运动（缓慢推近/缓慢拉远/平稳摇镜/平稳跟拍/环绕/固定机位/手持微晃/升镜/降镜/宏观推镜/微距对焦推近/显微景深游移/粒子特写/星轨环绕/宇宙俯冲/实验室摇镜等），速度均匀、不叠加。画面与科学主体一致时用运镜丝滑串联、禁止硬切；仅场景发生实质变化时才允许切镜头。\n\n【多镜头时间锚定】如需精确控制镜头节奏，用 [Shot N] At MM:SS.mmm 标注每个镜头起点，时间戳严格递增、落在总时长内。单镜头内动作不超过 2-3 个，复杂动作链拆分到多个镜头。每个镜头时长不低于1.5秒，相邻镜头时间戳间隔≥1.5秒，禁止一闪而过的碎镜头。\n\n【三轨音频】① 对白与画内声融入视听描述（标注说话人）；② 环境音/物理声/非语言人声（仪器轻响/液体流动/环境氛围声等）单独成段；③ 配乐单独成段（无则忽略）。三轨不重叠。\n\n【物理规律·强制】所有运动符合真实物理：重力向下、物体自然下落、液体流动、粒子漂移、分子运动、光线传播按真实规律，禁止反重力悬浮、物体凭空出现/消失、违反惯性瞬时变速。\n\n【色温】指定色温时严格遵循：暖光 3200K / 中性 4500K / 冷光 5600K。\n\n【物体状态锁定】科学主体被分解/消耗后只留真实反应产物，不复活、不重置。\n\n【科学主体锁定·科普专业】科学主体的结构/材质/颜色/尺度严格锁定于参考图，不漂移、不融化、不简化、不被 AI 重新设计。科学主体始终是画面主角——每一帧都能看到科学主体或通过光影/构图暗示其存在。\n\n【科学写实质感】禁止CG感/塑料感/3D渲染。真实材质纹理（金属光泽/玻璃通透/生物组织质感）、真实不完全完美。静止也有反应液体流动/分子运动/粒子漂移/光线变化，主体由形态与质感细节传递（克制真实不夸张），动态有加减速与重心转移；禁止蜡像感/塑料质感/死板结构/固定状态/机器人匀速/瞬间起停/卡通夸张渲染。\n\n【禁止】禁止文字/水印/字幕/对话框/标签；禁止分辨率/画幅/模型名。No text overlays, no watermarks, no subtitles, no captions.\n\n【合规】生物制品/科普内容仅展示产品与科学场景，不做疾病疗效、诊疗、药效或绝对化科学结论承诺，避免伪科学表述。';

const DEFAULT_RULES: VideoGenRules = {
  version: '32',
  integration: {
    model: 'minimax/minimax-h3',
    max_tokens: 0,
    system_prompt: '',
  },
  negative_prompt: 'texture distortion, structural drift, scale inconsistency, color bleeding, material smear, shape morphing, particle count error, geometry warp, lighting inconsistency, extra objects, missing components, plastic look, rigid simulation, unnatural drape, floating object, chromatic aberration, morphing, distortion, flicker, unnatural physics, CG look, plastic texture, 3D render, video game graphics, oversaturated colors, fake glow, AI watermark, empty frame, static image, abrupt transition, doll-like, wax figure, frozen state, dead structure, lifeless detail, uncanny valley, robotic movement, mechanical motion, exaggerated effect, pseudo-science exaggeration, cartoon render, stiffness, waxiness',
  prompt_rule: DEFAULT_PROMPT_RULE,
  constraints: {
    global_rule: '故事板宫格=连续短视频时间线。画面内容 100% 由参考图锁定，文本只写运镜+动作+声音。用中文自然语言描述摄像机运动，多镜头用 [Shot N] At MM:SS.mmm 时间戳锚定。科学写实摄影，禁止 CG/塑料/3D 渲染质感。',
    object_persistence: '科学主体每一帧都存在。结构/纹理/色彩/尺度由宫格锁定，不消失、不变形、不增减。',
    landmark_lock: '科学主体外观由参考图锁定。运镜不改变结构/纹理/色彩/尺度。',
    spatial_progression: '科学呈现旅程：整体→微观·静态→动态。每个镜头推进科学故事，不随机跳转无关主体。',
    motion_catalog: '缓慢推近 | 缓慢拉远 | 平稳摇镜 | 平稳跟拍 | 环绕 | 固定机位 | 手持微晃 | 升镜 | 降镜 | 宏观推镜 | 微距对焦推近 | 显微景深游移 | 粒子特写 | 星轨环绕 | 宇宙俯冲 | 实验室摇镜',
    shot_continuity: '六格→一个连续视频。摄像机运动均匀串联，每格停留足够时间（每个镜头时长≥1.5秒，禁止一闪而过的碎镜头）。场景/光影/科学主体跨格一致。画面与科学主体一致时用运镜连贯过渡、禁止硬切；仅场景发生实质变化时才可切镜头。',
    hard_constraints: [
      '宫格1-6是连续时间线，顺序不变',
      '不添加/不删减/不修改画面内容',
      '用摄像机运动丝滑串联，画面/科学主体一致时禁止硬切；仅场景发生实质变化时才可切镜头',
      '提示词只写运镜+动作+声音，不写光影/场景/外观',
      '多镜头用 [Shot N] At MM:SS.mmm 时间戳锚定，严格递增',
      '每个镜头时长≥1.5秒，相邻镜头时间戳间隔≥1.5秒，禁止一闪而过的碎镜头',
      '三轨音频分离：对白/画内声融入视听描述，环境音/物理声单独，配乐单独',
      '色温严格按指定值',
      '物体状态跨格锁定',
      '所有运动必须符合真实物理规律（重力/惯性/碰撞/流体），禁止反重力悬浮和物体穿模',
      '科学主体的结构/材质/颜色/尺度严格锁死参考图，禁止AI自行重新设计或简化科学主体外观',
      'Science realism: subtle motion, real material texture, structural integrity — never frozen, never doll-like, never plastic.',
      '生物制品/科普内容仅展示产品与科学场景，不做疾病疗效、诊疗、药效或绝对化科学结论承诺。',
    ],
  },
};

let cachedRules: VideoGenRules | null = null;
let fetchPromise: Promise<VideoGenRules> | null = null;

export async function fetchVideoGenRules(model?: string): Promise<VideoGenRules> {
  if (cachedRules) return cachedRules;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const raw: string = await invoke('fetch_video_gen_rules', { model: model || null });
      const parsed = JSON.parse(raw) as VideoGenRules;
      if (parsed?.version && parsed.constraints) {
        cachedRules = parsed;
        return cachedRules;
      }
      throw new Error('Invalid rules from server');
    } catch (e) {
      console.warn('[videoGenRules] Server fetch failed, using fallback:', e);
      cachedRules = DEFAULT_RULES;
      return cachedRules;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export function getCachedRules(): VideoGenRules | null {
  return cachedRules;
}

export function clearRulesCache(): void {
  cachedRules = null;
  fetchPromise = null;
}
