import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { authenticate } from "@google-cloud/local-auth";
import { google, gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export async function createGmailClient(credentialsPath: string): Promise<gmail_v1.Gmail> {
  const authStorageDir = path.resolve("Creds", "auth");
  mkdirSync(authStorageDir, { recursive: true });
  const tokenPath = resolveTokenPath(credentialsPath);

  const auth = loadSavedCredentials(credentialsPath, tokenPath) ?? (await authenticateAndPersist(credentialsPath, tokenPath));

  return google.gmail({
    version: "v1",
    auth,
  });
}

function loadSavedCredentials(credentialsPath: string, tokenPath: string): OAuth2Client | null {
  const candidatePaths = [tokenPath, path.resolve("Creds", "auth", "gmail-token.json")];

  for (const candidatePath of candidatePaths) {
    if (!existsSync(candidatePath)) {
      continue;
    }

    try {
      const tokenContent = readFileSync(candidatePath, "utf8");
      const tokenJson = JSON.parse(tokenContent) as Record<string, unknown>;
      const auth = google.auth.fromJSON(tokenJson);

      if (candidatePath !== tokenPath) {
        writeFileSync(tokenPath, JSON.stringify(tokenJson, null, 2), "utf8");
      }

      return auth as OAuth2Client;
    } catch {
      continue;
    }
  }

  return null;
}

async function authenticateAndPersist(credentialsPath: string, tokenPath: string): Promise<OAuth2Client> {
  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: credentialsPath,
  });

  persistCredentials(auth, credentialsPath, tokenPath);
  return auth;
}

function persistCredentials(auth: OAuth2Client, credentialsPath: string, tokenPath: string): void {
  const credentialsContent = readFileSync(credentialsPath, "utf8");
  const credentialJson = JSON.parse(credentialsContent) as {
    installed?: {
      client_id: string;
      client_secret: string;
    };
  };

  const client = credentialJson.installed;
  if (!client) {
    throw new Error("Expected Desktop OAuth client JSON with an installed client.");
  }

  const refreshToken = auth.credentials.refresh_token;
  if (!refreshToken) {
    throw new Error("Google OAuth did not return a refresh token to persist.");
  }

  writeFileSync(
    tokenPath,
    JSON.stringify(
      {
        type: "authorized_user",
        client_id: client.client_id,
        client_secret: client.client_secret,
        refresh_token: refreshToken,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function resolveTokenPath(credentialsPath: string): string {
  const baseName = path.basename(credentialsPath, path.extname(credentialsPath));
  const safeName = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gmail";
  const hash = createHash("sha1").update(path.resolve(credentialsPath)).digest("hex").slice(0, 8);
  return path.resolve("Creds", "auth", `${safeName}-${hash}-token.json`);
}
