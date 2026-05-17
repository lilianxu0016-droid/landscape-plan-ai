export type DrawingType = {
    id: string;
    title: string;
    shortName: string;
    description: string;
    size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
    prompt: string;
  };
  
  export const DRAWING_TYPES: DrawingType[] = [
    {
      id: "colored-master-plan",
      title: "彩色总平面图",
      shortName: "总平面",
      description: "将草图转化为专业景观彩色总平面图，保留原始空间结构。",
      size: "1024x1024",
      prompt: `
  Transform the uploaded landscape plan into a cleaner, more professional colored landscape master plan.
  
  Keep:
  - original site boundary
  - original road and path structure
  - original water system
  - original green space structure
  - original plazas, nodes, buildings, and main spatial layout
  
  Improve:
  - color rendering
  - planting texture
  - paving texture
  - water texture
  - line clarity
  - professional presentation quality
  
  Output style:
  - top-down landscape architecture master plan
  - clean professional design board style
  - no perspective view
  - no fantasy elements
  - no excessive small text
  `,
    },
    {
      id: "functional-zoning",
      title: "功能分区图",
      shortName: "分区",
      description: "生成活动、休闲、生态、交通等功能分区表达。",
      size: "1024x1024",
      prompt: `
  Create a clean functional zoning diagram based on the uploaded landscape plan.
  Preserve the original layout and use transparent color blocks to show major functional zones.
  `,
    },
    {
      id: "circulation-analysis",
      title: "流线设计图",
      shortName: "流线",
      description: "生成主次流线、慢行流线、服务流线、节点联系图。",
      size: "1024x1024",
      prompt: `
  Create a professional circulation analysis diagram based on the uploaded landscape plan.
  Preserve the original plan and add clear primary and secondary circulation arrows.
  `,
    },
    {
      id: "grading-analysis",
      title: "竖向设计图",
      shortName: "竖向",
      description: "生成概念性高程、坡向、排水、台地关系表达。",
      size: "1024x1024",
      prompt: `
  Create a conceptual landscape grading diagram based on the uploaded plan.
  Add simple contour lines, slope arrows, drainage arrows, and platform level indications.
  `,
    },
    {
      id: "section-drawing",
      title: "剖面图",
      shortName: "剖面",
      description: "根据平面关系生成一张代表性景观剖面表达。",
      size: "1536x1024",
      prompt: `
  Create one professional landscape section drawing inferred from the uploaded plan.
  Show terrain, paths, planting layers, water or plaza if relevant, and human scale.
  `,
    },
    {
      id: "node-detail",
      title: "节点放大图",
      shortName: "节点",
      description: "选择核心节点并生成放大设计表达。",
      size: "1024x1024",
      prompt: `
  Create a professional enlarged node detail plan from the most important node in the uploaded landscape plan.
  Show paving, planting, seating, lighting, edges, and human activity.
  `,
    },
    {
      id: "bird-eye-view",
      title: "平面转鸟瞰图",
      shortName: "鸟瞰",
      description: "将平面草图转为整体鸟瞰效果。",
      size: "1536x1024",
      prompt: `
  Transform the uploaded landscape plan into a professional bird's-eye view rendering.
  Preserve the original spatial organization, paths, water, planting, plazas, buildings, and nodes.
  `,
    },
    {
      id: "human-perspective",
      title: "人视点效果图",
      shortName: "人视",
      description: "生成行人视角的景观空间效果图。",
      size: "1536x1024",
      prompt: `
  Create a professional human-eye-level landscape rendering based on the key public space in the uploaded plan.
  Show planting, paving, people, seating, lighting, and spatial atmosphere.
  `,
    },
    {
      id: "exploded-axonometric",
      title: "爆炸分析图",
      shortName: "爆炸",
      description: "生成空间层级、交通、功能、绿化、水体等分层分析图。",
      size: "1024x1024",
      prompt: `
  Create a professional exploded axonometric analysis diagram based on the uploaded landscape plan.
  Separate layers: base site, circulation, functional zones, planting, water, structures, and activity nodes.
  `,
    },
  ];
  
  export function getDrawingType(id: string) {
    return DRAWING_TYPES.find((item) => item.id === id);
  }