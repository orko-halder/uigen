import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth is not configured" },
      { status: 503 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "read:user user:email",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/github/callback`,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
}
