import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    ok: false,
    error: "旧后台查询接口已停用，请使用 /api/generate。",
  });
}
