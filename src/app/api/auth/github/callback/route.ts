import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

async function exchangeCodeForToken(code: string): Promise<string | null> {
  const response = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/github/callback`,
      }),
    }
  );

  const data: GitHubTokenResponse = await response.json();
  return data.error ? null : data.access_token;
}

async function getGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

async function getGitHubPrimaryEmail(token: string): Promise<string | null> {
  const response = await fetch("https://api.github.com/user/emails", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const emails: GitHubEmail[] = await response.json();
  const primary = emails.find((e) => e.primary && e.verified);
  return primary?.email ?? null;
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}?auth_error=github_denied`);
  }

  const accessToken = await exchangeCodeForToken(code);
  if (!accessToken) {
    return NextResponse.redirect(`${appUrl}?auth_error=github_token`);
  }

  const [githubUser, primaryEmail] = await Promise.all([
    getGitHubUser(accessToken),
    getGitHubPrimaryEmail(accessToken),
  ]);

  const email = githubUser.email ?? primaryEmail;
  if (!email) {
    return NextResponse.redirect(`${appUrl}?auth_error=github_no_email`);
  }

  const githubId = String(githubUser.id);

  // Find existing user by githubId or email, then upsert
  let user = await prisma.user.findFirst({
    where: { OR: [{ githubId }, { email }] },
  });

  if (user) {
    // Update GitHub fields if signing in via GitHub for the first time
    if (!user.githubId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          githubId,
          name: user.name ?? githubUser.name,
          avatar: user.avatar ?? githubUser.avatar_url,
        },
      });
    }
  } else {
    user = await prisma.user.create({
      data: {
        email,
        githubId,
        name: githubUser.name,
        avatar: githubUser.avatar_url,
      },
    });
  }

  await createSession(user.id, user.email);

  return NextResponse.redirect(appUrl);
}
