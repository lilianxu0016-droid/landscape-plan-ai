"use client";

import { useEffect, useState } from "react";
import {
  UploadCloud,
  ImageIcon,
  Loader2,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers3,
  Wand2,
  RotateCcw,
  Clock3,
  Trash2,
  LockKeyhole,
  LogOut,
} from "lucide-react";
import { DRAWING_TYPES, type DrawingType } from "@/lib/drawing-types";

type GeneratedImage = {
  id: string;
  title: string;
  imageUrl: string;
};

type Status =
  | "idle"
  | "creating"
  | "queued"
  | "in_progress"
  | "success"
  | "error";

type StatusMap = Record<string, Status>;

type TimingMap = Record<
  string,
  {
    startedAt?: number;
    elapsedSeconds?: number;
  }
>;

const ACCESS_STORAGE_KEY = "landscape_plan_ai_demo_access_code";

function createInitialStatusMap(): StatusMap {
  return Object.fromEntries(
    DRAWING_TYPES.map((item) => [item.id, "idle"])
  ) as StatusMap;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isActiveStatus(status: Status) {
  return status === "creating" || status === "queued" || status === "in_progress";
}

function formatSeconds(seconds: number) {
  if (!seconds || seconds < 0) return "0 秒";

  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  if (min <= 0) return `${sec} 秒`;

  return `${min} 分 ${sec} 秒`;
}

async function readResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: `服务器返回了非 JSON 内容：${text.slice(0, 800)}`,
    };
  }
}

async function compressImageFile(file: File): Promise<File> {
  const imageUrl = URL.createObjectURL(file);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });

  const maxWidth = 1000;
  const maxHeight = 1000;

  let targetWidth = image.width;
  let targetHeight = image.height;

  const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight, 1);

  targetWidth = Math.round(targetWidth * ratio);
  targetHeight = Math.round(targetHeight * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    URL.revokeObjectURL(imageUrl);
    return file;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  URL.revokeObjectURL(imageUrl);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.78);
  });

  if (!blob) {
    return file;
  }

  return new File([blob], "compressed-landscape-plan.jpg", {
    type: "image/jpeg",
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("图片读取失败。"));
      }
    };

    reader.onerror = () => {
      reject(new Error("图片读取失败。"));
    };

    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [originalFileInfo, setOriginalFileInfo] = useState("");
  const [compressedFileInfo, setCompressedFileInfo] = useState("");
  const [preview, setPreview] = useState("");
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [statusMap, setStatusMap] = useState<StatusMap>(
    createInitialStatusMap()
  );
  const [timingMap, setTimingMap] = useState<TimingMap>({});
  const [error, setError] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const [currentTitle, setCurrentTitle] = useState("");

  useEffect(() => {
    const savedCode = window.localStorage.getItem(ACCESS_STORAGE_KEY);

    if (savedCode) {
      setAccessCode(savedCode);
      setAccessCodeInput(savedCode);
      setIsUnlocked(true);
    }
  }, []);

  const isGenerating = Object.values(statusMap).some(isActiveStatus);

  const successCount = Object.values(statusMap).filter(
    (item) => item === "success"
  ).length;

  const errorCount = Object.values(statusMap).filter(
    (item) => item === "error"
  ).length;

  const activeCount = Object.values(statusMap).filter(isActiveStatus).length;

  async function handleUnlock() {
    const code = accessCodeInput.trim();

    if (!code) {
      setAccessError("请输入访问码。");
      return;
    }

    try {
      setIsCheckingAccess(true);
      setAccessError("");

      const response = await fetch("/api/check-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessCode: code,
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        setAccessError(data.error || "访问码验证失败。");
        return;
      }

      window.localStorage.setItem(ACCESS_STORAGE_KEY, code);
      setAccessCode(code);
      setIsUnlocked(true);
    } catch {
      setAccessError("访问码验证失败，请稍后重试。");
    } finally {
      setIsCheckingAccess(false);
    }
  }

  function handleLogoutDemo() {
    if (isGenerating) return;

    window.localStorage.removeItem(ACCESS_STORAGE_KEY);
    setAccessCode("");
    setAccessCodeInput("");
    setIsUnlocked(false);
    setAccessError("");
  }

  function getStatusText(status: Status) {
    if (status === "creating") return "正在创建后台任务";
    if (status === "queued") return "任务排队中";
    if (status === "in_progress") return "后台生成中";
    if (status === "success") return "生成完成";
    if (status === "error") return "生成失败";
    return "等待生成";
  }

  function getStatusIcon(status: Status) {
    if (isActiveStatus(status)) {
      return <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />;
    }

    if (status === "success") {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }

    if (status === "error") {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }

    return <Layers3 className="h-5 w-5 text-zinc-300" />;
  }

  function getElapsedSeconds(typeId: string) {
    const timing = timingMap[typeId];
    const status = statusMap[typeId];

    if (!timing) return 0;

    if (isActiveStatus(status) && timing.startedAt) {
      return Math.max(0, Math.round((Date.now() - timing.startedAt) / 1000));
    }

    return timing.elapsedSeconds || 0;
  }

  function replaceResult(image: GeneratedImage) {
    setResults((prev) => {
      const filtered = prev.filter((item) => item.id !== image.id);
      return [...filtered, image];
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const uploaded = e.target.files?.[0];

    if (!uploaded) return;

    const allowed = ["image/png", "image/jpeg", "image/webp"];

    if (!allowed.includes(uploaded.type)) {
      setError("请上传 PNG、JPG 或 WebP 格式的草图。");
      return;
    }

    if (uploaded.size > 25 * 1024 * 1024) {
      setError("原始图片过大，请先压缩到 25MB 以内再上传。");
      return;
    }

    try {
      setIsCompressing(true);
      setError("");
      setResults([]);
      setStatusMap(createInitialStatusMap());
      setTimingMap({});
      setTotalElapsedTime(0);
      setCurrentTitle("");
      setImageDataUrl("");

      const compressed = await compressImageFile(uploaded);
      const dataUrl = await fileToDataUrl(compressed);

      setFile(compressed);
      setImageDataUrl(dataUrl);

      setOriginalFileInfo(
        `${uploaded.name}｜${(uploaded.size / 1024 / 1024).toFixed(2)} MB`
      );

      setCompressedFileInfo(
        `${compressed.name}｜${(compressed.size / 1024 / 1024).toFixed(2)} MB`
      );

      const url = URL.createObjectURL(compressed);
      setPreview(url);
    } catch {
      setError("图片压缩失败，请换一张 JPG 或 PNG 图片后重试。");
    } finally {
      setIsCompressing(false);
    }
  }

  async function startGeneration(typeId: string) {
    if (!file || !imageDataUrl) {
      throw new Error("请先上传草图。");
    }

    if (!accessCode) {
      throw new Error("请先输入 Demo 访问码。");
    }

    const response = await fetch("/api/bg-start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageDataUrl,
        typeId,
        accessCode,
      }),
    });

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "创建后台生成任务失败。");
    }

    if (!data.responseId) {
      throw new Error("后台任务创建失败：没有返回 responseId。");
    }

    return data as {
      responseId: string;
      status: string;
      id: string;
      title: string;
    };
  }

  async function pollGeneration(task: {
    responseId: string;
    id: string;
    title: string;
  }) {
    const maxAttempts = 240;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await sleep(5000);

      const url = `/api/bg-check?responseId=${encodeURIComponent(
        task.responseId
      )}&typeId=${encodeURIComponent(task.id)}&title=${encodeURIComponent(
        task.title
      )}`;

      const response = await fetch(url, {
        headers: {
          "X-Demo-Access-Code": accessCode,
        },
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "查询后台任务失败。");
      }

      if (!data.done) {
        setStatusMap((prev) => ({
          ...prev,
          [task.id]: data.status === "queued" ? "queued" : "in_progress",
        }));
        continue;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data.image as GeneratedImage;
    }

    throw new Error("后台任务等待时间过长，请稍后重试。");
  }

  async function generateSingle(item: DrawingType) {
    const startTime = Date.now();

    setCurrentTitle(item.title);
    setError("");

    setTimingMap((prev) => ({
      ...prev,
      [item.id]: {
        startedAt: startTime,
        elapsedSeconds: 0,
      },
    }));

    setStatusMap((prev) => ({
      ...prev,
      [item.id]: "creating",
    }));

    try {
      const task = await startGeneration(item.id);

      setStatusMap((prev) => ({
        ...prev,
        [item.id]: task.status === "queued" ? "queued" : "in_progress",
      }));

      const image = await pollGeneration(task);

      const elapsedSeconds = Math.max(
        1,
        Math.round((Date.now() - startTime) / 1000)
      );

      replaceResult(image);

      setStatusMap((prev) => ({
        ...prev,
        [item.id]: "success",
      }));

      setTimingMap((prev) => ({
        ...prev,
        [item.id]: {
          startedAt: undefined,
          elapsedSeconds,
        },
      }));

      return {
        ok: true,
        title: item.title,
        message: "",
      };
    } catch (err) {
      const elapsedSeconds = Math.max(
        1,
        Math.round((Date.now() - startTime) / 1000)
      );

      setStatusMap((prev) => ({
        ...prev,
        [item.id]: "error",
      }));

      setTimingMap((prev) => ({
        ...prev,
        [item.id]: {
          startedAt: undefined,
          elapsedSeconds,
        },
      }));

      return {
        ok: false,
        title: item.title,
        message: err instanceof Error ? err.message : "生成失败，请稍后重试。",
      };
    }
  }

  async function handleGenerateAll() {
    if (!file || !imageDataUrl) {
      setError("请先上传一张景观设计草图。");
      return;
    }

    if (!accessCode) {
      setError("请先输入 Demo 访问码。");
      return;
    }

    if (isGenerating) return;

    const targets = DRAWING_TYPES.filter(
      (item) => statusMap[item.id] !== "success"
    );

    if (targets.length === 0) {
      setError("九张图已经全部生成完成。如需重新生成，请点击“清空结果”。");
      return;
    }

    setError("");
    setTotalElapsedTime(0);

    const timer = window.setInterval(() => {
      setTotalElapsedTime((prev) => prev + 1);
    }, 1000);

    const failed: string[] = [];

    try {
      for (const item of targets) {
        const result = await generateSingle(item);

        if (!result.ok) {
          failed.push(result.title);
        }
      }

      setCurrentTitle("");

      if (failed.length > 0) {
        setError(
          `有 ${failed.length} 张图生成失败，可单独重试：${failed.join("、")}`
        );
      }
    } finally {
      window.clearInterval(timer);
    }
  }

  async function handleRetryOne(item: DrawingType) {
    if (!file || !imageDataUrl) {
      setError("请先上传一张景观设计草图。");
      return;
    }

    if (!accessCode) {
      setError("请先输入 Demo 访问码。");
      return;
    }

    if (isGenerating) return;

    setTotalElapsedTime(0);

    const timer = window.setInterval(() => {
      setTotalElapsedTime((prev) => prev + 1);
    }, 1000);

    try {
      const result = await generateSingle(item);

      if (!result.ok) {
        setError(`${result.title} 生成失败：${result.message}`);
      } else {
        setError("");
      }

      setCurrentTitle("");
    } finally {
      window.clearInterval(timer);
    }
  }

  function handleClearAll() {
    if (isGenerating) return;

    setResults([]);
    setStatusMap(createInitialStatusMap());
    setTimingMap({});
    setError("");
    setCurrentTitle("");
    setTotalElapsedTime(0);
  }

  if (!isUnlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F2EC] px-4 text-zinc-900">
        <section className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-black/5">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <LockKeyhole className="h-6 w-6" />
          </div>

          <p className="text-sm font-medium text-zinc-500">
            Landscape Plan AI Demo
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            输入访问码
          </h1>

          <p className="mt-3 text-sm leading-6 text-zinc-500">
            这是景观设计智能出图 Demo。为避免 API 额度被随意消耗，请输入访问码后继续使用。
          </p>

          <input
            value={accessCodeInput}
            onChange={(event) => setAccessCodeInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleUnlock();
              }
            }}
            placeholder="请输入 Demo 访问码"
            className="mt-6 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm outline-none ring-zinc-950/10 transition focus:bg-white focus:ring-4"
          />

          <button
            onClick={handleUnlock}
            disabled={isCheckingAccess}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-4 font-medium text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingAccess ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                正在验证
              </>
            ) : (
              <>
                <LockKeyhole className="h-5 w-5" />
                进入 Demo
              </>
            )}
          </button>

          {accessError && (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {accessError}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F2EC] text-zinc-900">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] bg-zinc-950 px-6 py-8 text-white shadow-xl sm:px-10 sm:py-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80">
                <Sparkles className="h-4 w-4" />
                Landscape Plan AI
              </div>

              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl">
                上传一张草图，自动生成九类专业景观设计图纸
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-white/70 sm:text-lg">
                当前是九图稳定性测试版。系统会使用后台任务逐张生成九类图纸，
                优先验证是否能用、生成速度和成本控制，图片质量后续再迭代。
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-sm text-white/70 backdrop-blur">
              <p className="font-medium text-white">当前模式</p>
              <p className="mt-2 leading-6">
                gpt-image-1.5 + medium + 后台逐张生成。已成功图片不会重复生成，
                失败图片可单张重试。
              </p>

              <button
                onClick={handleLogoutDemo}
                disabled={isGenerating}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-xs text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                退出访问码
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-zinc-500">完成进度</p>
            <p className="mt-2 text-2xl font-semibold">
              {successCount} / {DRAWING_TYPES.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-zinc-500">失败数量</p>
            <p className="mt-2 text-2xl font-semibold">{errorCount}</p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-zinc-500">运行状态</p>
            <p className="mt-2 text-sm font-medium">
              {activeCount > 0 ? "正在生成" : "空闲"}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-zinc-500">本轮耗时</p>
            <p className="mt-2 text-sm font-medium">
              {formatSeconds(totalElapsedTime)}
            </p>
          </div>
        </section>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
          当前版本重点验证“能不能稳定生成九张”。质量暂时不评价。生成过程中请不要刷新页面。
          如果中途某张失败，可以在对应卡片里单独重试，不需要重新生成已成功图片。
        </div>

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="flex flex-col gap-6">
            <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="text-xl font-semibold">1. 上传设计草图</h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                支持 JPG、PNG、WebP。系统会自动压缩后再上传，用于控制速度和成本。
              </p>

              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center transition hover:bg-zinc-100">
                <UploadCloud className="mb-3 h-10 w-10 text-zinc-500" />
                <span className="font-medium">
                  {isCompressing ? "正在压缩图片..." : "点击上传草图"}
                </span>
                <span className="mt-1 text-xs text-zinc-500">
                  PNG / JPG / WebP，建议原图小于 10MB
                </span>

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isCompressing || isGenerating}
                />
              </label>

              {originalFileInfo && compressedFileInfo && (
                <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-xs leading-6 text-zinc-500">
                  <p>原始图片：{originalFileInfo}</p>
                  <p>压缩后：{compressedFileInfo}</p>
                </div>
              )}

              {preview && (
                <div className="mt-5 overflow-hidden rounded-3xl border bg-zinc-50">
                  <img
                    src={preview}
                    alt="草图预览"
                    className="h-auto w-full object-contain"
                  />
                </div>
              )}
            </div>

            <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="text-xl font-semibold">2. 后台生成图纸</h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                点击后会依次生成未完成的图纸。已成功的图不会重复生成。
              </p>

              {isGenerating && (
                <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-700">
                  后台任务运行中，已等待 {formatSeconds(totalElapsedTime)}。
                  {currentTitle && (
                    <span className="font-medium">
                      {" "}
                      当前正在生成：{currentTitle}
                    </span>
                  )}
                  <br />
                  请不要刷新页面。
                </div>
              )}

              <div className="mt-5 grid gap-3">
                {DRAWING_TYPES.map((item, index) => {
                  const status = statusMap[item.id];
                  const elapsed = getElapsedSeconds(item.id);

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={[
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                            status === "success"
                              ? "bg-green-600"
                              : status === "error"
                              ? "bg-red-500"
                              : isActiveStatus(status)
                              ? "bg-zinc-950"
                              : "bg-zinc-400",
                          ].join(" ")}
                        >
                          {index + 1}
                        </div>

                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs leading-5 text-zinc-500">
                            {getStatusText(status)}
                            {elapsed > 0 && `｜${formatSeconds(elapsed)}`}
                          </p>
                        </div>
                      </div>

                      <div className="ml-3 shrink-0">
                        {getStatusIcon(status)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={handleGenerateAll}
                  disabled={isGenerating || isCompressing}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-4 font-medium text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      正在生成
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-5 w-5" />
                      一键生成 / 继续生成
                    </>
                  )}
                </button>

                <button
                  onClick={handleClearAll}
                  disabled={isGenerating}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-4 font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-5 w-5" />
                  清空结果
                </button>
              </div>

              {error && (
                <div className="mt-4 flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">3. 生成结果</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  每完成一张图都会自动显示。失败图可单独重试。
                </p>
              </div>

              <p className="text-sm text-zinc-500">
                已生成 {successCount} / {DRAWING_TYPES.length}
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {DRAWING_TYPES.map((item) => {
                const status = statusMap[item.id];
                const result = results.find((r) => r.id === item.id);
                const elapsed = getElapsedSeconds(item.id);

                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50"
                  >
                    <div className="flex items-center justify-between border-b bg-white px-4 py-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-zinc-500">
                          {getStatusText(status)}
                          {elapsed > 0 && `｜${formatSeconds(elapsed)}`}
                        </p>
                      </div>

                      {getStatusIcon(status)}
                    </div>

                    <div className="flex aspect-[4/3] items-center justify-center bg-zinc-100">
                      {result ? (
                        <img
                          src={result.imageUrl}
                          alt={result.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="px-4 text-center text-sm text-zinc-400">
                          {getStatusText(status)}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 bg-white p-3">
                      {result && (
                        <a
                          href={result.imageUrl}
                          download={`${result.title}.png`}
                          className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium hover:bg-zinc-50"
                        >
                          <Download className="h-4 w-4" />
                          下载图片
                        </a>
                      )}

                      <button
                        onClick={() => handleRetryOne(item)}
                        disabled={isGenerating || isCompressing || !file}
                        className={[
                          "flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                          status === "error"
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-zinc-950 text-white hover:bg-zinc-800",
                        ].join(" ")}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {status === "success"
                          ? "重新生成这张"
                          : status === "error"
                          ? "重试这张"
                          : "生成这张"}
                      </button>

                      {elapsed > 0 && (
                        <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
                          <Clock3 className="h-3.5 w-3.5" />
                          用时 {formatSeconds(elapsed)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {results.length === 0 && !isGenerating && (
              <div className="mt-6 flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center">
                <ImageIcon className="h-12 w-12 text-zinc-300" />
                <p className="mt-4 font-medium text-zinc-600">
                  后台任务完成后，生成结果会显示在这里
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
                  当前版本用于测试九张图是否能完整跑完。请先记录速度和失败情况。
                </p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}