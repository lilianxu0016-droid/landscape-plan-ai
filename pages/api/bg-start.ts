import type { NextApiRequest, NextApiResponse } from "next";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { getDrawingType } from "../../lib/drawing-types";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
    responseLimit: false,
  },
};

function getProxyUrl() {
  return (
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy ||
    ""
  );
}

function getProxyAgent() {
  const proxyUrl = getProxyUrl();

  if (!proxyUrl) return undefined;

  return new ProxyAgent(proxyUrl);
}

function validateAccessCode(accessCode?: string) {
  const demoCode = process.env.DEMO_ACCESS_CODE;

  if (!demoCode) {
    return {
      ok: false,
      message: "服务器缺少 DEMO_ACCESS_CODE，请检查环境变量。",
    };
  }

  if (!accessCode) {
    return {
      ok: false,
      message: "缺少访问码。",
    };
  }

  if (accessCode !== demoCode) {
    return {
      ok: false,
      message: "访问码错误。",
    };
  }

  return {
    ok: true,
    message: "ok",
  };
}

function buildPrompt(basePrompt: string) {
  return `
You are a senior landscape architect and professional landscape visualization expert.

The uploaded image is the user's landscape design plan or sketch.

Your task:
Create a refined professional landscape architecture drawing based on the uploaded image.

Strict requirements:
- Preserve the original site boundary.
- Preserve the original circulation, water system, planting areas, plazas, buildings, and main spatial layout.
- Do not redesign the project from scratch.
- Improve visual quality, color rendering, texture, line clarity, and professional presentation.
- Keep the result clean, legible, and suitable for a formal landscape architecture presentation board.
- Avoid fantasy elements.
- Avoid excessive tiny text.

Specific drawing task:
${basePrompt}
`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        endpoint: "/api/bg-start",
        method: req.method,
        message: "bg-start API is working.",
        proxy: getProxyUrl() || "not set",
        quality: "medium",
        accessProtection: Boolean(process.env.DEMO_ACCESS_CODE),
        time: new Date().toISOString(),
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed. Use POST.",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const mainModel = process.env.OPENAI_MAIN_MODEL || "gpt-5.2";
    const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";

    if (!apiKey) {
      return res.status(500).json({
        error: "服务器缺少 OPENAI_API_KEY，请检查 .env.local。",
      });
    }

    const { imageDataUrl, typeId, accessCode } = req.body as {
      imageDataUrl?: string;
      typeId?: string;
      accessCode?: string;
    };

    const accessResult = validateAccessCode(accessCode);

    if (!accessResult.ok) {
      return res.status(401).json({
        error: accessResult.message,
      });
    }

    if (!imageDataUrl) {
      return res.status(400).json({
        error: "缺少 imageDataUrl。",
      });
    }

    if (!typeId) {
      return res.status(400).json({
        error: "缺少 typeId。",
      });
    }

    const drawingType = getDrawingType(typeId);

    if (!drawingType) {
      return res.status(400).json({
        error: "未知图纸类型。",
      });
    }

    const requestBody = {
      model: mainModel,
      background: true,
      store: true,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(drawingType.prompt),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
      tools: [
        {
          type: "image_generation",
          model: imageModel,
          quality: "medium",
          size: drawingType.size,
          background: "opaque",
          output_format: "png",
          action: "edit",
        },
      ],
    };

    const proxyAgent = getProxyAgent();

    const openaiResponse = await undiciFetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        dispatcher: proxyAgent,
      }
    );

    const responseText = await openaiResponse.text();

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(500).json({
        error:
          "OpenAI 返回了非 JSON 内容：" + responseText.slice(0, 1200),
      });
    }

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          "创建后台生成任务失败。",
        raw: data,
      });
    }

    return res.status(200).json({
      responseId: data.id,
      status: data.status,
      id: drawingType.id,
      title: drawingType.title,
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? `创建后台生成任务失败：${error.message}`
          : "创建后台生成任务失败。",
    });
  }
}