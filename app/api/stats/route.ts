import { NextResponse } from "next/server";
import { getCreatedSecretCount } from "@/lib/store";

export async function GET() {
  const createdSecretCount = await getCreatedSecretCount();

  return NextResponse.json(
    { createdSecretCount },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
