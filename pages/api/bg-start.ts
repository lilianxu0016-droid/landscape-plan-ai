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

function isLoadTestMode() {
  return process.env.LOAD_TEST_MODE === "true";
}

function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function logPerformance(data: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      service: "landscape-plan-ai",
      timestamp: new Date().toISOString(),
      ...data,
    })
  );
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
  const requestId = createRequestId();
  const apiStartTime = Date.now();

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
        loadTestMode: isLoadTestMode(),
        mockGenerationDelayMs: Number(
          process.env.MOCK_GENERATION_DELAY_MS || 3000
        ),
        time: new Date().toISOString(),
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed. Use POST.",
      });
    }

    const { imageDataUrl, typeId, accessCode } = req.body as {
      imageDataUrl?: string;
      typeId?: string;
      accessCode?: string;
    };

    const accessResult = validateAccessCode(accessCode);

    if (!accessResult.ok) {
      logPerformance({
        requestId,
        endpoint: "bg-start",
        mode: isLoadTestMode() ? "mock" : "real",
        status: "access_denied",
        typeId,
        durationMs: Date.now() - apiStartTime,
      });

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

    const imageDataSizeKb = Math.round(imageDataUrl.length / 1024);

    if (isLoadTestMode()) {
      const mockResponseId = `mock_${drawingType.id}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;

      logPerformance({
        requestId,
        endpoint: "bg-start",
        mode: "mock",
        status: "created",
        typeId: drawingType.id,
        title: drawingType.title,
        imageDataSizeKb,
        durationMs: Date.now() - apiStartTime,
      });

      return res.status(200).json({
        responseId: mockResponseId,
        status: "in_progress",
        id: drawingType.id,
        title: drawingType.title,
        mock: true,
        metrics: {
          requestId,
          mode: "mock",
          imageDataSizeKb,
          apiDurationMs: Date.now() - apiStartTime,
        },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const mainModel = process.env.OPENAI_MAIN_MODEL || "gpt-5.2";
    const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";

    if (!apiKey) {
      return res.status(500).json({
        error: "服务器缺少 OPENAI_API_KEY，请检查环境变量。",
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
    const openaiStartTime = Date.now();

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

    const openaiCreateDurationMs = Date.now() - openaiStartTime;
    const responseText = await openaiResponse.text();

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      logPerformance({
        requestId,
        endpoint: "bg-start",
        mode: "real",
        status: "openai_non_json",
        typeId: drawingType.id,
        imageDataSizeKb,
        openaiCreateDurationMs,
        durationMs: Date.now() - apiStartTime,
      });

      return res.status(500).json({
        error: "OpenAI 返回了非 JSON 内容：" + responseText.slice(0, 1200),
      });
    }

    if (!openaiResponse.ok) {
      logPerformance({
        requestId,
        endpoint: "bg-start",
        mode: "real",
        status: "openai_error",
        typeId: drawingType.id,
        title: drawingType.title,
        imageDataSizeKb,
        openaiCreateDurationMs,
        durationMs: Date.now() - apiStartTime,
        openaiStatus: openaiResponse.status,
        openaiError: data?.error?.message || data?.message || "unknown",
      });

      return res.status(openaiResponse.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          "创建后台生成任务失败。",
        raw: data,
      });
    }

    logPerformance({
      requestId,
      endpoint: "bg-start",
      mode: "real",
      status: "created",
      typeId: drawingType.id,
      title: drawingType.title,
      imageDataSizeKb,
      openaiResponseId: data.id,
      openaiInitialStatus: data.status,
      openaiCreateDurationMs,
      durationMs: Date.now() - apiStartTime,
    });

    return res.status(200).json({
      responseId: data.id,
      status: data.status,
      id: drawingType.id,
      title: drawingType.title,
      metrics: {
        requestId,
        mode: "real",
        imageDataSizeKb,
        openaiCreateDurationMs,
        apiDurationMs: Date.now() - apiStartTime,
      },
    });
  } catch (error) {
    logPerformance({
      requestId,
      endpoint: "bg-start",
      mode: isLoadTestMode() ? "mock" : "real",
      status: "server_error",
      durationMs: Date.now() - apiStartTime,
      error: error instanceof Error ? error.message : "unknown",
    });

    return res.status(500).json({
      error:
        error instanceof Error
          ? `创建后台生成任务失败：${error.message}`
          : "创建后台生成任务失败。",
    });
  }
}