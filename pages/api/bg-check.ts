import type { NextApiRequest, NextApiResponse } from "next";
import { ProxyAgent, fetch as undiciFetch } from "undici";

export const config = {
  api: {
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET" && !req.query.responseId) {
      return res.status(200).json({
        ok: true,
        endpoint: "/api/bg-check",
        message: "bg-check API is working.",
        proxy: getProxyUrl() || "not set",
        accessProtection: Boolean(process.env.DEMO_ACCESS_CODE),
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
      return res.status(401).json({
        error: accessResult.message,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "服务器缺少 OPENAI_API_KEY，请检查 .env.local。",
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

    const proxyAgent = getProxyAgent();

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

    const responseText = await openaiResponse.text();

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(500).json({
        error:
          "OpenAI 查询接口返回了非 JSON 内容：" +
          responseText.slice(0, 1200),
      });
    }

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          "查询后台任务失败。",
        raw: data,
      });
    }

    if (data.status === "queued" || data.status === "in_progress") {
      return res.status(200).json({
        status: data.status,
        done: false,
      });
    }

    if (data.status !== "completed") {
      return res.status(200).json({
        status: data.status,
        done: true,
        error:
          data?.error?.message ||
          data?.incomplete_details?.reason ||
          "后台生成任务未完成。",
        raw: data,
      });
    }

    const imageBase64 = findImageResult(data.output);

    if (!imageBase64) {
      return res.status(200).json({
        status: data.status,
        done: true,
        error: "任务已完成，但没有找到图像结果。",
        raw: data,
      });
    }

    return res.status(200).json({
      status: data.status,
      done: true,
      image: {
        id: typeId,
        title,
        imageUrl: `data:image/png;base64,${imageBase64}`,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? `查询后台任务失败：${error.message}`
          : "查询后台任务失败。",
    });
  }
}