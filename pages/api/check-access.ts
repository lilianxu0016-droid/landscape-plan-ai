import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const expectedAccessCode = process.env.DEMO_ACCESS_CODE;
  const accessCode = String(req.body?.accessCode || "").trim();

  if (!expectedAccessCode) {
    return res.status(500).json({
      ok: false,
      error: "服务端未配置 DEMO_ACCESS_CODE。",
    });
  }

  if (accessCode !== expectedAccessCode) {
    return res.status(401).json({
      ok: false,
      error: "访问码错误，请检查后重新输入。",
    });
  }

  return res.status(200).json({ ok: true });
}
