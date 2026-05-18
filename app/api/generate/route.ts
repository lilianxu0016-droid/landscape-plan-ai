export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function createMockSvg(style: string, hasImage: boolean) {
  const safeStyle = escapeXml(style || "现代简约");
  const uploadedText = hasImage ? "已接收上传图片" : "未上传图片，使用文字描述生成 mock";

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <rect width="1200" height="760" fill="#f8fafc"/>
  <rect x="56" y="56" width="1088" height="648" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <path d="M160 548 C300 468 438 568 584 478 C722 392 838 460 1038 336" fill="none" stroke="#0f766e" stroke-width="34" stroke-linecap="round"/>
  <path d="M184 252 C318 206 420 282 546 220 C700 146 808 234 1006 168" fill="none" stroke="#38bdf8" stroke-width="24" stroke-linecap="round"/>
  <circle cx="342" cy="436" r="72" fill="#bbf7d0" stroke="#16a34a" stroke-width="4"/>
  <circle cx="740" cy="310" r="96" fill="#dcfce7" stroke="#15803d" stroke-width="4"/>
  <circle cx="910" cy="520" r="58" fill="#d9f99d" stroke="#65a30d" stroke-width="4"/>
  <rect x="484" y="368" width="174" height="112" rx="14" fill="#e2e8f0" stroke="#64748b" stroke-width="4"/>
  <rect x="746" y="486" width="144" height="82" rx="14" fill="#fde68a" stroke="#d97706" stroke-width="4"/>
  <text x="96" y="120" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#0f172a">Landscape Plan AI Mock Result</text>
  <text x="96" y="166" font-family="Arial, sans-serif" font-size="22" fill="#475569">风格：${safeStyle}</text>
  <text x="96" y="200" font-family="Arial, sans-serif" font-size="18" fill="#64748b">${uploadedText}</text>
  <text x="96" y="646" font-family="Arial, sans-serif" font-size="18" fill="#64748b">Demo 阶段：接口稳定性优先，真实图像模型调用位置已预留。</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function POST(request: Request) {
  const expectedAccessCode = process.env.DEMO_ACCESS_CODE;

  if (!expectedAccessCode) {
    return Response.json(
      {
        ok: false,
        error: "服务端未配置 DEMO_ACCESS_CODE，请先设置访问码环境变量。",
      },
      { status: 500 }
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      {
        ok: false,
        error: "请求格式不正确，请使用表单方式提交。",
      },
      { status: 400 }
    );
  }

  const accessCode = String(formData.get("accessCode") || "").trim();

  if (accessCode !== expectedAccessCode) {
    return Response.json(
      {
        ok: false,
        error: "访问码错误，请检查后重新输入。",
      },
      { status: 401 }
    );
  }

  const description = String(formData.get("description") || "").trim();
  const style = String(formData.get("style") || "现代简约").trim();
  const image = formData.get("image");
  const hasImage = image instanceof File && image.size > 0;

  if (hasImage && image.size > MAX_IMAGE_SIZE) {
    return Response.json(
      {
        ok: false,
        error: "上传图片超过 10MB，请压缩后重试。",
      },
      { status: 400 }
    );
  }

  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

  if (hasOpenAIKey) {
    // TODO: 在这里接入 OpenAI 图像模型。当前 demo 仍返回稳定 mock，避免部署验证阶段受模型耗时和额度影响。
  }

  return Response.json({
    ok: true,
    mode: hasOpenAIKey ? "openai-ready" : "mock",
    message: hasOpenAIKey
      ? "已检测到 OPENAI_API_KEY。当前版本先返回稳定 demo 结果，真实图像生成调用位置已预留。"
      : "未配置 OPENAI_API_KEY，已返回 mock demo 结果。",
    summary: description
      ? `基于“${description}”，生成一个偏“${style}”的景观设计 demo 方案。`
      : `生成一个偏“${style}”的景观设计 demo 方案。`,
    suggestions: [
      "保留主要场地边界和动线，先用清晰分区验证设计逻辑。",
      "优先布置入口、核心活动节点、休憩空间和连续绿化界面。",
      "后续接入真实图像模型时，可把上传图片和描述一起传入生成流程。",
    ],
    imagePreview: createMockSvg(style, hasImage),
  });
}
