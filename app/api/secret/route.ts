import { NextRequest, NextResponse } from "next/server";
import { createSecret, consumeSecret } from "@/lib/store";

const VALID_TTLS = new Set([3600, 86400, 604800]);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.ciphertext !== "string" ||
    typeof body.iv !== "string" ||
    typeof body.salt !== "string" ||
    typeof body.ttlSeconds !== "number" ||
    !VALID_TTLS.has(body.ttlSeconds)
  ) {
    return NextResponse.json({ error: "Ogiltig payload." }, { status: 400 });
  }

  if (body.ciphertext.length < 16 || body.ciphertext.length > 100000) {
    return NextResponse.json({ error: "Meddelandet ar for stort eller tomt." }, { status: 400 });
  }

  const result = await createSecret({
    ciphertext: body.ciphertext,
    iv: body.iv,
    salt: body.salt,
    ttlSeconds: body.ttlSeconds
  });

  return NextResponse.json({
    id: result.id,
    token: result.token,
    expiresAt: result.expiresAt
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.id !== "string" || typeof body.token !== "string") {
    return NextResponse.json({ error: "Ogiltig payload." }, { status: 400 });
  }

  const secret = await consumeSecret(body.id, body.token);
  if (!secret) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.json(secret, {
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
