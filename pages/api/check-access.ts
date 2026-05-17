import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST.",
    });
  }

  const demoCode = process.env.DEMO_ACCESS_CODE;

  if (!demoCode) {
    return res.status(500).json({
      error: "服务器缺少 DEMO_ACCESS_CODE，请检查环境变量。",
    });
  }

  const { accessCode } = req.body as {
    accessCode?: string;
  };

  if (!accessCode) {
    return res.status(400).json({
      error: "请输入访问码。",
    });
  }

  if (accessCode !== demoCode) {
    return res.status(401).json({
      error: "访问码错误，请重新输入。",
    });
  }

  return res.status(200).json({
    ok: true,
    message: "访问码验证成功。",
  });
}