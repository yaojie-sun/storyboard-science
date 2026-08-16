/**
 * 科普版行业预设 — 面向科普内容的AI短视频创作
 */
export const STYLE_PRESETS = [
  '写实', '显微高清', '深空星云', '未来科技', '实验室冷光',
  '自然生态', '微距细节', '赛博科幻', '纪实记录', '延时摄影',
  '宏观壮阔', '微观精密', '暖调科普', '冷调科研', '荧光显微',
];

export const TONE_PRESETS = [
  '严谨', '权威', '启发', '震撼', '神秘',
  '未来', '冷静', '温暖', '亲和', '探索',
  '理性', '浪漫', '宏大', '精确', '好奇',
];

export const SCIENCE_STYLE_PRESETS = [
  '宏观宇宙',
  '微观显微',
  '生物制品',
  '科幻世界',
  '实验演示',
  '科普活动',
  '科学故事',
  '自然生态',
  '知识讲解',
  '探索纪实',
  '未来畅想',
];

export const ASPECT_RATIO_OPTIONS = [
  { value: '', label: '未选择' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: '2.35:1', label: '2.35:1' },
  { value: '3:4', label: '3:4' },
];

export const SCIENCE_VIDEO_TYPES = [
  { value: 'macro', label: '宏观科学', desc: '宇宙星云/行星地质/气象生态等宏大尺度的科学奇观' },
  { value: 'micro', label: '微观科普', desc: '细胞/微生物/分子结构的显微视角微观世界' },
  { value: 'bioproduct', label: '生物制品', desc: '试剂/疫苗/检测盒/培养基的实验室与生产场景展示' },
  { value: 'scifi', label: '科幻世界', desc: '未来城市/星际航行/异星生态等科幻想象场景' },
  { value: 'experiment', label: '科学实验', desc: '实验演示/化学反应/物理现象等动手实验过程' },
  { value: 'activity', label: '科普活动', desc: '科普讲座/展览/协会公益等科普传播场景' },
  { value: 'story', label: '科学故事', desc: '拟人化科学叙事，科学概念拟人形象/内心独白/情节演绎' },
];

export const EMPHASIS_DIMENSIONS = [
  { key: 'clarity', label: '清晰度', desc: '主体与细节的高清锐利呈现，杜绝模糊与失真' },
  { key: 'precision', label: '精确性', desc: '结构与数据的精准呈现，形态比例准确无误' },
  { key: 'detail', label: '细节呈现', desc: '微观纹理/表面结构等细节的特写与微距强调' },
  { key: 'scale', label: '尺度对比', desc: '宏观与微观的尺度反差与参照物对比呈现' },
  { key: 'lighting', label: '光影氛围', desc: '实验室冷光/深空暗调/自然光等的氛围塑造' },
  { key: 'texture', label: '材质质感', desc: '金属/玻璃/生物组织等材质的真实质感呈现' },
  { key: 'color', label: '色彩还原', desc: '科学图像的真实色彩与荧光标记准确呈现' },
  { key: 'motion', label: '动态过程', desc: '反应/分裂/运动等科学过程的连续动态呈现' },
  { key: 'structure', label: '结构层次', desc: '从整体到局部的结构层次与空间关系表达' },
  { key: 'accuracy', label: '科学准确', desc: '科学事实与原理的准确表达，避免伪科学夸张' },
] as const;

const EMPHASIS_MAP: Map<string, { label: string; desc: string }> = new Map(
  EMPHASIS_DIMENSIONS.map((d) => [d.key as string, { label: d.label, desc: d.desc }]),
);

export function getEmphasisLabels(keys: string[]): string[] {
  return keys
    .map((k) => {
      const dim = EMPHASIS_MAP.get(k);
      return dim ? `${dim.label}（${dim.desc}）` : k;
    });
}

const VIDEO_TYPE_MAP: Map<string, string> = new Map(
  SCIENCE_VIDEO_TYPES.map((t) => [t.value, t.label]),
);

export function getVideoTypeLabel(key: string): string {
  return VIDEO_TYPE_MAP.get(key) ?? key;
}
