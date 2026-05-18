"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ImageUp,
  Loader2,
  Sparkles,
} from "lucide-react";

type GenerateResult = {
  ok: boolean;
  mode: "mock" | "openai-ready";
  message: string;
  summary: string;
  suggestions: string[];
  imagePreview?: string;
};

const styles = [
  "现代简约",
  "自然生态",
  "新中式",
  "城市公园",
  "商业景观",
  "度假庭院",
];

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text || "服务端返回了无法解析的内容。",
    };
  }
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState(styles[0]);
  const [accessCode, setAccessCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);

  const fileLabel = useMemo(() => {
    if (!file) return "支持 JPG、PNG、WebP，当前 demo 仅用于稳定流程验证";
    return `${file.name} / ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }, [file]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];

    if (!nextFile) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(nextFile.type)) {
      setError("请上传 JPG、PNG 或 WebP 格式的图片。");
      return;
    }

    if (nextFile.size > 10 * 1024 * 1024) {
      setError("图片请控制在 10MB 以内，便于 demo 稳定上传。");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setError("");
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessCode.trim()) {
      setError("请输入访问码。");
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("accessCode", accessCode.trim());
      formData.append("description", description.trim());
      formData.append("style", style);

      if (file) {
        formData.append("image", file);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await readJson(response);

      if (!response.ok) {
        setError(data.error || "生成失败，请稍后重试。");
        return;
      }

      setResult(data as GenerateResult);
    } catch {
      setError("请求失败，请检查网络或服务是否正在运行。");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <Sparkles className="h-4 w-4" />
                Stable AI Demo
              </div>
              <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                Landscape Plan AI 景观设计生成 Demo
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                这是一个面向部署验证的景观设计 AI demo。当前阶段优先保证页面可访问、接口稳定、访问码可控、没有
                OpenAI API Key 时也能返回 mock 结果，方便后续持续迭代真实图像生成能力。
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 lg:max-w-sm">
              <p className="font-medium text-slate-900">当前能力</p>
              <p className="mt-1">
                上传场地图片，填写项目描述和设计风格，点击生成后调用
                <span className="font-mono"> /api/generate</span>。
              </p>
            </div>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]"
        >
          <section className="flex flex-col gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">图片上传区域</h2>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:bg-slate-100">
                <ImageUp className="h-10 w-10 text-slate-500" />
                <span className="mt-3 text-sm font-medium text-slate-900">
                  点击上传现状图或草图
                </span>
                <span className="mt-1 text-xs leading-5 text-slate-500">
                  {fileLabel}
                </span>
                <input
                  className="hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                />
              </label>

              {previewUrl && (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <img
                    src={previewUrl}
                    alt="上传图片预览"
                    className="max-h-[360px] w-full object-contain"
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">访问控制</h2>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                访问码
              </label>
              <input
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm outline-none ring-emerald-600/20 transition focus:border-emerald-700 focus:ring-4"
                placeholder="请输入 DEMO_ACCESS_CODE"
                type="password"
                autoComplete="off"
              />
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">项目描述输入框</h2>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-4 min-h-36 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none ring-emerald-600/20 transition focus:border-emerald-700 focus:ring-4"
                placeholder="例如：社区口袋公园，约 800 平方米，希望增加儿童活动、休憩座椅、雨水花园和夜间照明。"
              />

              <h2 className="mt-6 text-lg font-semibold">设计风格选择</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {styles.map((item) => (
                  <label
                    key={item}
                    className={[
                      "flex cursor-pointer items-center justify-center rounded-md border px-3 py-3 text-sm font-medium transition",
                      style === item
                        ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name="style"
                      value={item}
                      checked={style === item}
                      onChange={() => setStyle(item)}
                    />
                    {item}
                  </label>
                ))}
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    生成中
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    生成方案
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">结果展示区域</h2>

              {!result && !isGenerating && (
                <div className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                  <Sparkles className="h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    生成结果会显示在这里
                  </p>
                  <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                    未配置 OPENAI_API_KEY 时，接口会返回稳定的 mock demo
                    结果，不会让页面崩溃。
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="mt-4 flex min-h-64 items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-600">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  正在调用 /api/generate
                </div>
              )}

              {result && (
                <div className="mt-4 grid gap-4">
                  <div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{result.message}</span>
                  </div>

                  {result.imagePreview && (
                    <img
                      src={result.imagePreview}
                      alt="Mock 景观设计结果"
                      className="w-full rounded-lg border border-slate-200 bg-white"
                    />
                  )}

                  <div className="rounded-md bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      方案摘要
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {result.summary}
                    </p>
                  </div>

                  <div className="rounded-md bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      设计建议
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-600">
                      {result.suggestions.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </section>
        </form>
      </section>
    </main>
  );
}
