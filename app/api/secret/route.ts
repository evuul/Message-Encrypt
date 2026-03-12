import { NextRequest, NextResponse } from "next/server";
import { MAX_CIPHERTEXT_LENGTH } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSecret, consumeSecret, StoreUnavailableError } from "@/lib/store";

const VALID_TTLS = new Set([3600, 86400, 604800]);
const CREATE_LIMIT = 20;
const OPEN_LIMIT = 40;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const createLimit = await checkRateLimit(
    `rate:create:${clientIp}`,
    CREATE_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS
  );

  if (!createLimit.allowed) {
    return NextResponse.json(
      { error: "För många nya meddelanden på kort tid. Vänta en minut och försök igen." },
      { status: 429 }
    );
  }

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

  if (body.ciphertext.length < 16 || body.ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
    return NextResponse.json({ error: "Meddelandet är för stort eller tomt." }, { status: 400 });
  }

  try {
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
  } catch (error) {
    if (error instanceof StoreUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const clientIp = getClientIp(request);
  const openLimit = await checkRateLimit(
    `rate:open:${clientIp}`,
    OPEN_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS
  );

  if (!openLimit.allowed) {
    return NextResponse.json(
      { error: "För många öppningsförsök på kort tid. Vänta en minut och försök igen." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.id !== "string" || typeof body.token !== "string") {
    return NextResponse.json({ error: "Ogiltig payload." }, { status: 400 });
  }

  try {
    const secret = await consumeSecret(body.id, body.token);
    if (!secret) {
      return NextResponse.json(
        { error: "Länken finns inte längre. Den kan ha öppnats tidigare eller gått ut." },
        { status: 404 }
      );
    }

    return NextResponse.json(secret, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    if (error instanceof StoreUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    throw error;
  }
}
