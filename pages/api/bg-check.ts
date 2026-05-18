import type { NextApiRequest, NextApiResponse } from "next";
import { ProxyAgent, fetch as undiciFetch } from "undici";

export const config = {
  api: {
    responseLimit: false,
  },
};

const MOCK_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

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

function getMockGenerationDelayMs() {
  const value = Number(process.env.MOCK_GENERATION_DELAY_MS || 3000);

  if (!Number.isFinite(value) || value < 0) {
    return 3000;
  }

  return value;
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

function findImageResult(output: any[]) {
  for (const item of output || []) {
    if (item?.type === "image_generation_call" && item?.result) {
      return item.result;
    }

    if (item?.type === "message" && Array.isArray(item?.content)) {
      for (const content of item.content) {
        if (content?.type === "image_generation_call" && content?.result) {
          return content.result;
        }
      }
    }
  }

  return null;
}

function parseMockResponseId(responseId: string) {
  const parts = responseId.split("_");

  if (parts.length < 4 || parts[0] !== "mock") {
    return null;
  }

  const timestampPart = parts[parts.length - 2];
  const createdAt = Number(timestampPart);

  if (!Number.isFinite(createdAt)) {
    return null;
  }

  return {
    createdAt,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = createRequestId();
  const apiStartTime = Date.now();

  try {
    if (req.method === "GET" && !req.query.responseId) {
      return res.status(200).json({
        ok: true,
        endpoint: "/api/bg-check",
        message: "bg-check API is working.",
        proxy: getProxyUrl() || "not set",
        accessProtection: Boolean(process.env.DEMO_ACCESS_CODE),
        loadTestMode: isLoadTestMode(),
        mockGenerationDelayMs: getMockGenerationDelayMs(),
        time: new Date().toISOString(),
      });
    }

    if (req.method !== "GET") {
      return res.status(405).json({
        error: "Method not allowed. Use GET.",
      });
    }

    const accessCode =
      typeof req.headers["x-demo-access-code"] === "string"
        ? req.headers["x-demo-access-code"]
        : "";

    const accessResult = validateAccessCode(accessCode);

    if (!accessResult.ok) {
      logPerformance({
        requestId,
        endpoint: "bg-check",
        mode: isLoadTestMode() ? "mock" : "real",
        status: "access_denied",
        durationMs: Date.now() - apiStartTime,
      });

      return res.status(401).json({
        error: accessResult.message,
      });
    }

    const responseId =
      typeof req.query.responseId === "string" ? req.query.responseId : "";

    const typeId =
      typeof req.query.typeId === "string"
        ? req.query.typeId
        : "generated-image";

    const title =
      typeof req.query.title === "string" ? req.query.title : "生成图纸";

    if (!responseId) {
      return res.status(400).json({
        error: "缺少 responseId。",
      });
    }

    if (isLoadTestMode()) {
      const mockInfo = parseMockResponseId(responseId);
      const now = Date.now();
      const delayMs = getMockGenerationDelayMs();

      if (!mockInfo) {
        return res.status(400).json({
          error: "模拟模式下 responseId 格式错误。",
        });
      }

      const elapsedMs = now - mockInfo.createdAt;

      if (elapsedMs < delayMs) {
        logPerformance({
          requestId,
          endpoint: "bg-check",
          mode: "mock",
          status: "in_progress",
          responseId,
          typeId,
          elapsedMs,
          durationMs: Date.now() - apiStartTime,
        });

        return res.status(200).json({
          status: "in_progress",
          done: false,
          mock: true,
          metrics: {
            requestId,
            mode: "mock",
            elapsedMs,
            apiDurationMs: Date.now() - apiStartTime,
          },
        });
      }

      logPerformance({
        requestId,
        endpoint: "bg-check",
        mode: "mock",
        status: "completed",
        responseId,
        typeId,
        elapsedMs,
        durationMs: Date.now() - apiStartTime,
      });

      return res.status(200).json({
        status: "completed",
        done: true,
        mock: true,
        image: {
          id: typeId,
          title,
          imageUrl: `data:image/png;base64,${MOCK_IMAGE_BASE64}`,
        },
        metrics: {
          requestId,
          mode: "mock",
          elapsedMs,
          apiDurationMs: Date.now() - apiStartTime,
        },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "服务器缺少 OPENAI_API_KEY，请检查环境变量。",
      });
    }

    const proxyAgent = getProxyAgent();
    const openaiCheckStartTime = Date.now();

    const openaiResponse = await undiciFetch(
      `https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        dispatcher: proxyAgent,
      }
    );

    const openaiCheckDurationMs = Date.now() - openaiCheckStartTime;
    const responseText = await openaiResponse.text();

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      logPerformance({
        requestId,
        endpoint: "bg-check",
        mode: "real",
        status: "openai_non_json",
        responseId,
        typeId,
        openaiCheckDurationMs,
        durationMs: Date.now() - apiStartTime,
      });

      return res.status(500).json({
        error:
          "OpenAI 查询接口返回了非 JSON 内容：" +
          responseText.slice(0, 1200),
      });
    }

    if (!openaiResponse.ok) {
      logPerformance({
        requestId,
        endpoint: "bg-check",
        mode: "real",
        status: "openai_error",
        responseId,
        typeId,
        openaiCheckDurationMs,
        durationMs: Date.now() - apiStartTime,
        openaiStatus: openaiResponse.status,
        openaiError: data?.error?.message || data?.message || "unknown",
      });

      return res.status(openaiResponse.status).json({
        error: data?.error?.message || data?.message || "查询后台任务失败。",
        raw: data,
      });
    }

    if (data.status === "queued" || data.status === "in_progress") {
      logPerformance({
        requestId,
        endpoint: "bg-check",
        mode: "real",
        status: data.status,
        responseId,
        typeId,
        openaiCheckDurationMs,
        durationMs: Date.now() - apiStartTime,
      });

      return res.status(200).json({
        status: data.status,
        done: false,
        metrics: {
          requestId,
          mode: "real",
          openaiCheckDurationMs,
          apiDurationMs: Date.now() - apiStartTime,
        },
      });
    }

    if (data.status !== "completed") {
      logPerformance({
        requestId,
        endpoint: "bg-check",
        mode: "real",
        status: "not_completed",
        responseId,
        typeId,
        openaiStatus: data.status,
        openaiCheckDurationMs,
        durationMs: Date.now() - apiStartTime,
        openaiError:
          data?.error?.message || data?.incomplete_details?.reason || "unknown",
      });

      return res.status(200).json({
        status: data.status,
        done: true,
        error:
          data?.error?.message ||
          data?.incomplete_details?.reason ||
          "后台生成任务未完成。",
        raw: data,
        metrics: {
          requestId,
          mode: "real",
          openaiCheckDurationMs,
          apiDurationMs: Date.now() - apiStartTime,
        },
      });
    }

    const imageBase64 = findImageResult(data.output);

    if (!imageBase64) {
      logPerformance({
        requestId,
        endpoint: "bg-check",
        mode: "real",
        status: "completed_no_image",
        responseId,
        typeId,
        openaiCheckDurationMs,
        durationMs: Date.now() - apiStartTime,
      });

      return res.status(200).json({
        status: data.status,
        done: true,
        error: "任务已完成，但没有找到图像结果。",
        raw: data,
      });
    }

    logPerformance({
      requestId,
      endpoint: "bg-check",
      mode: "real",
      status: "completed",
      responseId,
      typeId,
      openaiCheckDurationMs,
      durationMs: Date.now() - apiStartTime,
      outputBase64SizeKb: Math.round(imageBase64.length / 1024),
    });

    return res.status(200).json({
      status: data.status,
      done: true,
      image: {
        id: typeId,
        title,
        imageUrl: `data:image/png;base64,${imageBase64}`,
      },
      metrics: {
        requestId,
        mode: "real",
        openaiCheckDurationMs,
        apiDurationMs: Date.now() - apiStartTime,
        outputBase64SizeKb: Math.round(imageBase64.length / 1024),
      },
    });
  } catch (error) {
    logPerformance({
      requestId,
      endpoint: "bg-check",
      mode: isLoadTestMode() ? "mock" : "real",
      status: "server_error",
      durationMs: Date.now() - apiStartTime,
      error: error instanceof Error ? error.message : "unknown",
    });

    return res.status(500).json({
      error:
        error instanceof Error
          ? `查询后台任务失败：${error.message}`
          : "查询后台任务失败。",
    });
  }
}