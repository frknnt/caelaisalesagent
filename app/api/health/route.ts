import { NextResponse } from "next/server";

import { readRuntimeConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const mode = process.env.NODE_ENV;
  const config = readRuntimeConfig(process.env, mode);

  if (!config.ok) {
    return NextResponse.json(
      {
        status: "misconfigured",
        code: config.error.code,
        message: config.error.message,
      },
      { status: config.status },
    );
  }

  return NextResponse.json({ status: "ok" });
}
