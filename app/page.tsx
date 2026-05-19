"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ImageIcon,
  ImageUp,
  Layers3,
  Loader2,
  LogOut,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import ExampleShowcase from "./components/ExampleShowcase";

type DrawStatus = "idle" | "running" | "succeeded" | "failed";

type DrawingType = {
  id: string;
  title: string;
  subtitle: string;
};

type DrawingResult = DrawingType & {
  status: DrawStatus;
  message: string;
  imageUrl?: string;
  responseId?: string;
  seconds?: number;
};

const DRAWING_TYPES: DrawingType[] = [
  {
    id: "colored-master-plan",
    title: "彩色总平面图",
    subtitle: "将草图转化为专业景观彩色总平面图，保留原始空间结构。",
  },
  {
    id: "functional-zoning",
    title: "功能分区图",
    subtitle: "表达主要功能区、活动区、生态区与服务空间关系。",
  },
  {
    id: "circulation-analysis",
    title: "流线设计图",
    subtitle: "表达主次游线、入口、节点联系和慢行系统。",
  },
  {
    id: "grading-analysis",
    title: "竖向设计图",
    subtitle: "表达高程、坡向、排水、台地和地形组织。",
  },
  {
    id: "section-drawing",
    title: "剖面图",
    subtitle: "生成代表性景观剖面，展示空间和竖向关系。",
  },
  {
    id: "node-detail",
    title: "节点放大图",
    subtitle: "提取核心节点，表达铺装、植物、设施和细部关系。",
  },
  {
    id: "bird-eye-view",
    title: "平面转鸟瞰图",
    subtitle: "将二维平面转化为整体鸟瞰效果图。",
  },
  {
    id: "human-perspective",
    title: "人视点效果图",
    subtitle: "从人的视角表达空间氛围、植物层次和体验。",
  },
  {
    id: "exploded-axonometric",
    title: "爆炸分析图",
    subtitle: "分层表达空间结构、交通、功能、绿化与水体系统。",
  },
];

const ACCESS_STORAGE_KEY = "landscape-plan-ai-access-code";

function createInitialResults(): DrawingResult[] {
  return DRAWING_TYPES.map((item) => ({
    ...item,
    status: "idle",
    message: "等待生成",
  }));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 秒";

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  if (minutes <= 0) return seconds + " 秒";
  return minutes + " 分 " + seconds + " 秒";
}

function getImageUrlFromResponse(data: any): string | undefined {
  return (
    data?.image?.imageUrl ||
    data?.imageUrl ||
    data?.url ||
    data?.output?.imageUrl ||
    data?.result?.imageUrl
  );
}

async function readImageAsCompressedDataUrl(file: File): Promise<string> {
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });

  return await new Promise<string>((resolve) => {
    const image = new Image();

    image.onload = () => {
      const maxSize = 1800;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));

      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(originalDataUrl);
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };

    image.onerror = () => resolve(originalDataUrl);
    image.src = originalDataUrl;
  });
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [accessCode, setAccessCode] = useState("");
  const [draftAccessCode, setDraftAccessCode] = useState("");
  const [accessGranted, setAccessGranted] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessError, setAccessError] = useState("");

  const [sourceImageDataUrl, setSourceImageDataUrl] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [imageLoading, setImageLoading] = useState(false);

  const [results, setResults] = useState<DrawingResult[]>(createInitialResults);
  const [isGenerating, setIsGenerating] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(ACCESS_STORAGE_KEY);

    if (saved) {
      setAccessCode(saved);
      setDraftAccessCode(saved);
      setAccessGranted(true);
    }
  }, []);

  useEffect(() => {
    if (!isGenerating || !runStartedAt) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - runStartedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isGenerating, runStartedAt]);

  const completedCount = useMemo(
    () => results.filter((item) => item.status === "succeeded").length,
    [results]
  );

  const failedCount = useMemo(
    () => results.filter((item) => item.status === "failed").length,
    [results]
  );

  const runningCount = useMemo(
    () => results.filter((item) => item.status === "running").length,
    [results]
  );

  const successfulImages = useMemo(
    () => results.filter((item) => item.status === "succeeded" && item.imageUrl),
    [results]
  );

  async function handleAccessSubmit() {
    const code = draftAccessCode.trim();

    if (!code) {
      setAccessError("请输入访问码。");
      return;
    }

    setCheckingAccess(true);
    setAccessError("");

    try {
      const response = await fetch("/api/check-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessCode: code,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "访问码错误。");
      }

      window.localStorage.setItem(ACCESS_STORAGE_KEY, code);
      setAccessCode(code);
      setAccessGranted(true);
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "访问验证失败。");
    } finally {
      setCheckingAccess(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_STORAGE_KEY);
    setAccessCode("");
    setDraftAccessCode("");
    setAccessGranted(false);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setImageLoading(true);
    setGlobalError("");

    try {
      const dataUrl = await readImageAsCompressedDataUrl(file);
      setSourceImageDataUrl(dataUrl);
      setSourceFileName(file.name);
      setResults(createInitialResults());
      setElapsedSeconds(0);
      setRunStartedAt(null);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "图片处理失败。");
    } finally {
      setImageLoading(false);

      if (event.target) {
        event.target.value = "";
      }
    }
  }

  function updateResult(typeId: string, patch: Partial<DrawingResult>) {
    setResults((prev) =>
      prev.map((item) => (item.id === typeId ? { ...item, ...patch } : item))
    );
  }

  async function generateOne(typeId: string) {
    const target = DRAWING_TYPES.find((item) => item.id === typeId);

    if (!target) return false;

    if (!sourceImageDataUrl) {
      setGlobalError("请先上传一张草图。");
      return false;
    }

    if (!accessGranted || !accessCode) {
      setGlobalError("请先输入访问码。");
      return false;
    }

    const startedAt = Date.now();

    updateResult(typeId, {
      status: "running",
      message: "正在创建后台任务",
      imageUrl: undefined,
      responseId: undefined,
      seconds: undefined,
    });

    try {
      const startResponse = await fetch("/api/bg-start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageDataUrl: sourceImageDataUrl,
          typeId,
          accessCode,
          quality: "medium",
        }),
      });

      const startData = await startResponse.json().catch(() => null);

      if (!startResponse.ok || startData?.error) {
        throw new Error(startData?.error || "创建后台任务失败。");
      }

      const responseId = startData?.responseId || startData?.id;

      if (!responseId) {
        const directImageUrl = getImageUrlFromResponse(startData);

        if (directImageUrl) {
          updateResult(typeId, {
            status: "succeeded",
            message: "生成完成",
            imageUrl: directImageUrl,
            seconds: Math.round((Date.now() - startedAt) / 1000),
          });
          return true;
        }

        throw new Error("后台没有返回 responseId。");
      }

      updateResult(typeId, {
        responseId,
        message: "后台生成中",
      });

      for (let pollIndex = 0; pollIndex < 90; pollIndex += 1) {
        await sleep(5000);

        const checkUrl =
          "/api/bg-check?responseId=" +
          encodeURIComponent(responseId) +
          "&typeId=" +
          encodeURIComponent(typeId) +
          "&title=" +
          encodeURIComponent(target.title);

        const checkResponse = await fetch(checkUrl, {
          headers: {
            "X-Demo-Access-Code": accessCode,
          },
        });

        const checkData = await checkResponse.json().catch(() => null);

        if (!checkResponse.ok || checkData?.error) {
          throw new Error(checkData?.error || "查询生成状态失败。");
        }

        const imageUrl = getImageUrlFromResponse(checkData);

        if (checkData?.done === true || imageUrl) {
          if (!imageUrl) {
            throw new Error("任务完成，但没有返回图片。");
          }

          updateResult(typeId, {
            status: "succeeded",
            message: "生成完成",
            imageUrl,
            seconds: Math.round((Date.now() - startedAt) / 1000),
          });

          return true;
        }

        updateResult(typeId, {
          message: "后台生成中 | 已轮询 " + String(pollIndex + 1) + " 次",
          seconds: Math.round((Date.now() - startedAt) / 1000),
        });
      }

      throw new Error("生成超时，请稍后单独重试。");
    } catch (error) {
      updateResult(typeId, {
        status: "failed",
        message: error instanceof Error ? error.message : "生成失败",
        seconds: Math.round((Date.now() - startedAt) / 1000),
      });

      return false;
    }
  }

  async function handleGenerateAll() {
    if (isGenerating) return;

    if (!sourceImageDataUrl) {
      setGlobalError("请先上传一张草图。");
      return;
    }

    setGlobalError("");
    setIsGenerating(true);
    setRunStartedAt(Date.now());
    setElapsedSeconds(0);

    try {
      const queue = results.filter((item) => item.status !== "succeeded");

      for (const item of queue) {
        await generateOne(item.id);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateSingle(typeId: string) {
    if (isGenerating) return;

    setGlobalError("");
    setIsGenerating(true);
    setRunStartedAt(Date.now());

    try {
      await generateOne(typeId);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleClearResults() {
    setResults(createInitialResults());
    setElapsedSeconds(0);
    setRunStartedAt(null);
    setGlobalError("");
  }

  if (!accessGranted) {
    return (
      <main className="min-h-screen bg-[#f4f0e8] px-4 py-10 text-zinc-950">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <section className="w-full rounded-[2rem] border border-zinc-200 bg-white p-7 shadow-sm">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
              <Sparkles className="h-5 w-5" />
            </div>

            <p className="text-xs text-zinc-500">Landscape Plan AI Demo</p>
            <h1 className="mt-2 text-2xl font-semibold">输入访问码</h1>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
              这是景观设计智能出图 Demo。为避免 API 资源被随意调用，请输入访问码后继续使用。
            </p>

            <input
              value={draftAccessCode}
              onChange={(event) => setDraftAccessCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAccessSubmit();
              }}
              placeholder="请输入 Demo 访问码"
              className="mt-6 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-950"
            />

            {accessError && (
              <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {accessError}
              </div>
            )}

            <button
              onClick={handleAccessSubmit}
              disabled={checkingAccess}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checkingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              进入 Demo
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f0e8] px-4 py-8 text-zinc-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] bg-zinc-950 p-7 text-white shadow-xl sm:p-9">
          <div className="grid gap-7 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-white/85">
                <Sparkles className="h-4 w-4" />
                Landscape Plan AI
              </div>

              <h1 className="max-w-3xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl">
                上传一张草图，自动生成九类专业景观设计图纸
              </h1>

              <p className="mt-6 max-w-3xl text-base leading-7 text-white/75">
                当前是九图稳定性测试版。系统会使用后台任务逐张生成九类图纸，
                优先验证是否能用、生成速度和成本控制，图片质量后续再迭代。
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-sm font-semibold">当前模式</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                gpt-image-1.5 + medium + 后台逐张生成。已成功图片不会重复生成，
                失败图片可单张重试。
              </p>

              <button
                onClick={handleLogout}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
                退出访问码
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-zinc-500">完成进度</p>
            <p className="mt-3 text-2xl font-semibold">
              {completedCount} / {DRAWING_TYPES.length}
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-zinc-500">失败数量</p>
            <p className="mt-3 text-2xl font-semibold">{failedCount}</p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-zinc-500">运行状态</p>
            <p className="mt-3 text-sm font-semibold">
              {runningCount > 0 ? "生成中" : "空闲"}
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-zinc-500">本轮耗时</p>
            <p className="mt-3 text-sm font-semibold">{formatSeconds(elapsedSeconds)}</p>
          </div>
        </section>

        <div className="rounded-3xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
          当前版本重点验证“能不能稳定生成九张”。质量暂时不评价。生成过程中请不要刷新页面。
          如果中途某张失败，可以在对应卡片里单独重试，不需要重新生成已成功图片。
        </div>

        <ExampleShowcase />

        {globalError && (
          <div className="flex items-start gap-3 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-600">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {globalError}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">1. 上传设计草图</h2>

              <p className="mt-3 text-sm leading-6 text-zinc-500">
                支持 JPG、PNG、WebP。系统会自动压缩后再上传，用于控制速度和成本。
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 flex min-h-40 w-full flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center transition hover:bg-zinc-100"
              >
                {imageLoading ? (
                  <Loader2 className="h-9 w-9 animate-spin text-zinc-500" />
                ) : sourceImageDataUrl ? (
                  <img
                    src={sourceImageDataUrl}
                    alt="已上传草图"
                    className="max-h-56 w-full rounded-2xl object-contain"
                  />
                ) : (
                  <>
                    <ImageUp className="h-9 w-9 text-zinc-500" />
                    <p className="mt-3 text-sm font-semibold">点击上传草图</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      PNG / JPG / WebP，建议原图小于 10MB
                    </p>
                  </>
                )}
              </button>

              {sourceFileName && (
                <p className="mt-3 truncate text-xs text-zinc-500">
                  当前文件：{sourceFileName}
                </p>
              )}
            </section>

            <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">2. 后台生成成图纸</h2>

              <p className="mt-3 text-sm leading-6 text-zinc-500">
                点击后会依次生成未完成的图纸。已成功的图不会重复生成。
              </p>

              <div className="mt-5 space-y-3">
                {results.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white " +
                          (item.status === "succeeded"
                            ? "bg-emerald-500"
                            : item.status === "failed"
                              ? "bg-red-500"
                              : item.status === "running"
                                ? "bg-zinc-950"
                                : "bg-zinc-400")
                        }
                      >
                        {index + 1}
                      </div>

                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-zinc-500">{item.message}</p>
                      </div>
                    </div>

                    <Layers3 className="h-4 w-4 text-zinc-300" />
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={handleGenerateAll}
                  disabled={isGenerating || !sourceImageDataUrl}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  一键生成 / 继续生成
                </button>

                <button
                  onClick={handleClearResults}
                  disabled={isGenerating}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  清空结果
                </button>
              </div>
            </section>
          </div>

          <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">3. 生成结果</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  每完成一张图都会自动显示。失败图可单独重试。
                </p>
              </div>

              <p className="text-sm text-zinc-500">
                已生成 {completedCount} / {DRAWING_TYPES.length}
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-zinc-200 bg-white"
                >
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500">{item.message}</p>
                    </div>

                    {item.status === "succeeded" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : item.status === "failed" ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : item.status === "running" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                    ) : (
                      <Layers3 className="h-5 w-5 text-zinc-300" />
                    )}
                  </div>

                  <div className="flex h-48 items-center justify-center border-y border-zinc-200 bg-zinc-100">
                    {item.status === "succeeded" && item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : item.status === "running" ? (
                      <div className="flex flex-col items-center gap-3 text-sm text-zinc-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        后台生成中
                      </div>
                    ) : item.status === "failed" ? (
                      <div className="px-4 text-center text-sm leading-6 text-red-500">
                        {item.message}
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-400">等待生成</div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 p-3">
                    {item.status === "succeeded" && item.imageUrl ? (
                      <a
                        href={item.imageUrl}
                        download={item.title + ".png"}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white"
                      >
                        <Download className="h-4 w-4" />
                        下载图片
                      </a>
                    ) : (
                      <button
                        onClick={() => handleGenerateSingle(item.id)}
                        disabled={isGenerating || !sourceImageDataUrl}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-500 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw className="h-4 w-4" />
                        生成这张
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
              {successfulImages.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {successfulImages.map((item) => (
                    <div key={item.id} className="overflow-hidden rounded-2xl bg-white">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-56 w-full object-cover"
                      />
                      <div className="p-3 text-sm font-semibold">{item.title}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center text-center text-zinc-400">
                  <ImageIcon className="h-9 w-9" />
                  <p className="mt-4 text-sm font-semibold">
                    后台任务完成后，生成结果会显示在这里
                  </p>
                  <p className="mt-2 text-xs">
                    当前版本用于测试九张图是否能完整跑完。请先记录速度和失败情况。
                  </p>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
