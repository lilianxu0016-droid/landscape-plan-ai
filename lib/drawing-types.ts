export type DrawingType = {
  id: string;
  title: string;
  description: string;
};

export const DRAWING_TYPES: DrawingType[] = [
  {
    id: "master-plan",
    title: "彩色总平面图",
    description: "表达场地结构、道路、水体、绿化和主要节点。",
  },
  {
    id: "zoning",
    title: "功能分区图",
    description: "表达活动、休闲、生态、交通等功能关系。",
  },
  {
    id: "perspective",
    title: "人视点效果图",
    description: "表达关键节点的空间氛围和使用场景。",
  },
];

export function getDrawingType(id: string) {
  return DRAWING_TYPES.find((item) => item.id === id);
}
