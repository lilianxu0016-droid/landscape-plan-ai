import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createMockSvg(style: string, hasImage: boolean) {
  const safeStyle = escapeXml(style || "现代简约");
  const uploadedText = hasImage ? "已接收上传图片" : "未上传图片，使用文字描述生成 mock";

  const svg = [
    '<svg width="1024" height="768" viewBox="0 0 1024 768" xmlns="http://www.w3.org/2000/svg">',
    '<rect width="1024" height="768" fill="#f8fafc"/>',
    '<path d="M70 520 C220 440, 300 600, 445 500 S690 430, 940 320" fill="none" stroke="#0f766e" stroke-width="36" stroke-linecap="round"/>',
    '<path d="M64 230 C200 190, 320 250, 450 205 S720 180, 960 110" fill="none" stroke="#38bdf8" stroke-width="18" stroke-linecap="round"/>',
    '<circle cx="210" cy="440" r="62" fill="#bbf7d0" stroke="#16a34a" stroke-width="4"/>',
    '<circle cx="700" cy="340" r="86" fill="#dcfce7" stroke="#16a34a" stroke-width="4"/>',
    '<rect x="484" y="368" width="174" height="112" rx="14" fill="#e2e8f0" stroke="#64748b" stroke-width="4"/>',
    '<rect x="746" y="486" width="144" height="82" rx="14" fill="#fde68a" stroke="#d97706" stroke-width="4"/>',
    '<text x="96" y="120" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#0f172a">Landscape Plan AI Mock Result</text>',
    '<text x="96" y="166" font-family="Arial, sans-serif" font-size="22" fill="#475569">风格：' + safeStyle + '</text>',
    '<text x="96" y="200" font-family="Arial, sans-serif" font-size="18" fill="#64748b">' + uploadedText + '</text>',
    '</svg>',
  ].join("");

  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

function getString(formData: FormData, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = formData.get(key);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function getUploadedImage(formData: FormData) {
  const candidates = ["image", "file", "sketch", "upload", "inputImage"];

  for (const key of candidates) {
    const value = formData.get(key);

    if (value instanceof File && value.size > 0) {
      return value;
    }
  }

  return null;
}

function normalizeImageValue(value: unknown) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  if (!trimmed) return undefined;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }

  if (
    trimmed.length > 300 &&
    !trimmed.includes(" ") &&
    /^[A-Za-z0-9+/=]+$/.test(trimmed)
  ) {
    return "data:image/png;base64," + trimmed;
  }

  return undefined;
}

function extractImageUrl(data: any) {
  const candidates = [
    data?.data?.[0]?.b64_json,
    data?.data?.[0]?.url,
    data?.output?.[0]?.b64_json,
    data?.output?.[0]?.url,
    data?.image?.b64_json,
    data?.image?.base64,
    data?.image?.url,
    data?.imageUrl,
    data?.image_url,
    data?.url,
  ];

  for (const item of candidates) {
    const normalized = normalizeImageValue(item);

    if (normalized) return normalized;
  }

  return undefined;
}

function buildLandscapePrompt(params: {
  drawingType: string;
  subtitle: string;
  prompt: string;
  description: string;
}) {
  const drawingType = params.drawingType || "景观设计图纸";
  const subtitle = params.subtitle || "基于上传草图生成专业景观设计图纸。";
  const prompt = params.prompt || "";
  const description = params.description || "";

  return [
    "You are a professional landscape architecture visualization assistant.",
    "Use the uploaded sketch as the spatial base map.",
    "Preserve the original site boundary, main paths, water bodies, open spaces, nodes, circulation logic, and approximate proportions.",
    "",
    "Output type: " + drawingType,
    "",
    "Design intent: " + (description || subtitle || drawingType),
    "",
    "User prompt: " + prompt,
    "",
    "Graphic requirements:",
    "1. Produce a professional landscape architecture drawing, not a generic cartoon.",
    "2. Keep the drawing clean, readable, and suitable for a design presentation board.",
    "3. Avoid random unrelated buildings, roads, labels, logos, or text artifacts.",
    "4. Use coherent planting, paving, water, terrain, and spatial hierarchy.",
    "5. The result should clearly match the requested drawing type.",
    "",
    "Specific drawing type requirement: " + subtitle,
  ].join("\n");
}

async function callOpenAIImageEdit(params: {
  image: File;
  prompt: string;
  model: string;
  quality: string;
}) {
  const form = new FormData();

  form.append("model", params.model);
  form.append("image", params.image, params.image.name || "landscape-sketch.png");
  form.append("prompt", params.prompt);
  form.append("n", "1");
  form.append("size", "1024x1024");
  form.append("quality", params.quality || "medium");
  form.append("output_format", "png");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY,
    },
    body: form,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      "OpenAI 图像生成接口调用失败。";

    throw new Error(message);
  }

  const imageUrl = extractImageUrl(data);

  if (!imageUrl) {
    throw new Error("OpenAI 已返回结果，但没有找到图片数据。");
  }

  return {
    imageUrl,
    raw: data,
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/generate",
    method: "GET",
    message: "/api/generate API is working.",
    mode:
      process.env.LOAD_TEST_MODE === "true"
        ? "mock"
        : process.env.OPENAI_API_KEY
          ? "openai"
          : "missing-openai-key",
    imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    time: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          ok: false,
          error: "请求格式不正确，请使用表单方式提交。",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    const expectedCode = process.env.DEMO_ACCESS_CODE || "";
    const submittedCode =
      request.headers.get("x-demo-access-code") ||
      getString(formData, ["accessCode", "demoAccessCode", "code"], "");

    if (expectedCode && submittedCode !== expectedCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "访问码错误。",
        },
        { status: 401 }
      );
    }

    const image = getUploadedImage(formData);

    if (!image) {
      return NextResponse.json(
        {
          ok: false,
          error: "没有收到上传图片。",
        },
        { status: 400 }
      );
    }

    if (image.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: "图片过大，请上传小于 10MB 的图片。",
        },
        { status: 400 }
      );
    }

    const drawingType = getString(
      formData,
      ["drawingTypeTitle", "drawingType", "title", "style", "selectedStyle"],
      "彩色总平面图"
    );

    const subtitle = getString(
      formData,
      ["drawingTypeSubtitle", "subtitle", "description"],
      "基于上传草图生成专业景观设计图纸。"
    );

    const description = getString(
      formData,
      ["projectDescription", "description", "summary"],
      ""
    );

    const userPrompt = getString(formData, ["prompt", "instruction"], "");
    const quality = getString(formData, ["quality"], "medium");

    if (process.env.LOAD_TEST_MODE === "true") {
      const mockImage = createMockSvg(drawingType, Boolean(image));

      return NextResponse.json({
        ok: true,
        mode: "mock",
        message: "LOAD_TEST_MODE=true，已返回 mock demo 结果。",
        imageUrl: mockImage,
        imagePreview: mockImage,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          mode: "missing-openai-key",
          error: "未配置 OPENAI_API_KEY，无法调用真实 OpenAI 图像模型。",
        },
        { status: 500 }
      );
    }

    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

    const finalPrompt = buildLandscapePrompt({
      drawingType,
      subtitle,
      prompt: userPrompt,
      description,
    });

    const result = await callOpenAIImageEdit({
      image,
      prompt: finalPrompt,
      model,
      quality,
    });

    return NextResponse.json({
      ok: true,
      mode: "openai",
      model,
      message: "生成完成。",
      imageUrl: result.imageUrl,
      imagePreview: result.imageUrl,
      summary: "已生成：" + drawingType,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "error",
        error: error instanceof Error ? error.message : "生成失败。",
      },
      { status: 500 }
    );
  }
}
