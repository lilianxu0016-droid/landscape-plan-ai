"use client";

import { useState } from "react";

type ExampleImage = {
  src: string;
  alt: string;
  title: string;
  desc: string;
};

function ExampleCard({ src, alt, title, desc }: ExampleImage) {
  const [failed, setFailed] = useState(false);

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-zinc-100">
        {!failed ? (
          <img
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
          />
        ) : (
          <div className="px-4 text-center text-sm text-zinc-400">
            图片未找到
            <div className="mt-2 text-xs leading-5">
              请检查 public/examples 中的图片文件名和后缀
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-100 p-4">
        <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{desc}</p>
      </div>
    </article>
  );
}

const outputs: ExampleImage[] = [
  {
    src: "/examples/master-plan-01.png",
    alt: "彩色总平面图示例",
    title: "1. 彩色总平面图",
    desc: "将草图转化为具有植物、水体、道路、铺装和边界表达的专业总平面。",
  },
  {
    src: "/examples/zoning-01.png",
    alt: "功能分区图示例",
    title: "2. 功能分区图",
    desc: "用色块表达活动、生态、交通和服务等功能结构。",
  },
  {
    src: "/examples/circulation-01.png",
    alt: "流线设计图示例",
    title: "3. 流线设计图",
    desc: "表达主次游线、入口、慢行路径和节点联系。",
  },
  {
    src: "/examples/grading-01.png",
    alt: "竖向设计图示例",
    title: "4. 竖向设计图",
    desc: "表达高程、坡向、排水、台地和地形组织关系。",
  },
  {
    src: "/examples/section-01.png",
    alt: "剖面图示例",
    title: "5. 剖面图",
    desc: "展示地形、植物、活动空间和竖向关系。",
  },
  {
    src: "/examples/node-01.png",
    alt: "节点放大图示例",
    title: "6. 节点放大图",
    desc: "展示核心节点的铺装、植物、设施和空间细节。",
  },
  {
    src: "/examples/birdview-01.png",
    alt: "平面转鸟瞰图示例",
    title: "7. 平面转鸟瞰图",
    desc: "将二维平面方案转化为整体鸟瞰空间效果。",
  },
  {
    src: "/examples/perspective-01.png",
    alt: "人视点效果图示例",
    title: "8. 人视点效果图",
    desc: "从人的视角表达场地氛围、植物层次和路径体验。",
  },
  {
    src: "/examples/exploded-01.png",
    alt: "爆炸分析图示例",
    title: "9. 爆炸分析图",
    desc: "分层表达空间结构、交通、功能、绿化和水体系统。",
  },
];

export default function ExampleShowcase() {
  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600">
            示例展示
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            从一张草图到九类景观设计图纸
          </h2>

          <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-500 sm:text-base">
            用户上传一张景观设计草图后，系统可自动生成彩色总平面图、功能分区图、
            流线设计图、竖向设计图、剖面图、节点放大图、鸟瞰图、人视点效果图和爆炸分析图。
            以下示例展示了从输入草图到九类图纸输出的完整流程。
          </p>
        </div>

        <div className="rounded-3xl bg-zinc-950 px-5 py-4 text-sm leading-6 text-white/75">
          <p className="font-semibold text-white">示例流程</p>
          <p className="mt-1">输入草图 → AI 解析空间结构 → 输出九类图纸</p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.75fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900">输入草图</p>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">
              Sketch
            </span>
          </div>

          <ExampleCard
            src="/examples/sketch-01.jpg"
            alt="输入草图示例"
            title="输入草图"
            desc="用户上传的原始设计草图，可为手绘图、总平面草图或初步方案图。"
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900">生成结果</p>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">
              9 Drawing Types
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {outputs.map((item) => (
              <ExampleCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
