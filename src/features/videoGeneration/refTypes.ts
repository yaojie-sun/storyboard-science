export type RefImageType = 'storyboard' | 'character' | 'scene' | 'science' | 'object' | 'unknown';

export interface RefImageMeta {
  index: number;
  type: RefImageType;
  label: string;
}

export const REF_TYPE_LABELS: Record<RefImageType, string> = {
  storyboard: '分镜图',
  character: '人物参考',
  scene: '场景参考',
  science: '科普参考',
  object: '物品参考',
  unknown: '参考图',
};

function detectRefType(text: string): RefImageType {
  const s = text.toLowerCase();
  if (/分镜|宫格|storyboard|镜头顺序|分格|格子/.test(s)) return 'storyboard';
  if (/人物|角色|主角|character|人像|人脸|脸部|脸|外貌|长相|五官/.test(s)) return 'character';
  if (/科学|科普|细胞|微生物|细菌|病毒|分子|原子|DNA|基因|染色体|显微镜|培养皿|标本|切片|天文|宇宙|星系|星云|行星|地质|化石|晶体|试剂|疫苗|检测盒|培养基|试管|烧杯|science|cell|microscope|dna|atom|cosmos|nebula|molecule/.test(s)) return 'science';
  if (/场景|背景|环境|scene|background|风景|地点|室内|室外|客厅|花园|房间/.test(s)) return 'scene';
  if (/物品|道具|产品|object|product|prop|物件|商品|碗|玩具/.test(s)) return 'object';
  return 'unknown';
}

function extractRefDesc(prompt: string, index: number): string {
  const i = index + 1;
  const patterns = [
    new RegExp(`(?:@|＠)图${i}[：:，,。\\s]*(.+?)(?:[。，,;；]|$)`, 'i'),
    new RegExp(`第${i}[张个]图[：:，,。\\s]*(.+?)(?:[。，,;；]|$)`, 'i'),
    new RegExp(`图${i}[：:，,。\\s]*(.+?)(?:[。，,;；]|$)`, 'i'),
  ];
  for (const p of patterns) {
    const m = prompt.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return '';
}

export function inferRefTypes(prompt: string, refCount: number): RefImageMeta[] {
  return Array.from({ length: refCount }, (_, i) => {
    const desc = extractRefDesc(prompt, i);
    return { index: i, type: detectRefType(desc), label: desc };
  });
}
