import type { Db } from "@platform/db";
import { LEGAL_VERSIONS } from "@platform/shared";
import type { AcceptConsentsBody, ConsentStatus } from "@platform/shared/contracts";
import * as repository from "./account.repository";

// Persetujuan legal (ACC-002 layar S&K pertama kali untuk user Google, ACC-313 penerimaan ulang versi baru).

export interface ConsentEvidence {
  ip?: string;
  userAgent?: string;
}

function legalStatus(rows: repository.ConsentRow[], type: "terms" | "privacy") {
  const latest = rows.find((row) => row.type === type);
  const currentVersion = LEGAL_VERSIONS[type];
  return {
    accepted: latest?.granted === true && latest.version === currentVersion,
    currentVersion,
    acceptedVersion: latest?.granted ? latest.version : null,
  };
}

export function createAccountService(db: Db) {
  async function consentStatus(userId: string): Promise<ConsentStatus> {
    const rows = await repository.listUserConsents(db, userId);
    return {
      terms: legalStatus(rows, "terms"),
      privacy: legalStatus(rows, "privacy"),
      marketing: { granted: rows.find((row) => row.type === "marketing")?.granted === true },
    };
  }

  async function acceptConsents(
    userId: string,
    body: AcceptConsentsBody,
    evidence: ConsentEvidence,
  ): Promise<ConsentStatus> {
    const base = { userId, ip: evidence.ip ?? null, userAgent: evidence.userAgent ?? null };
    await repository.insertUserConsents(db, [
      { ...base, type: "terms", version: LEGAL_VERSIONS.terms, granted: true },
      { ...base, type: "privacy", version: LEGAL_VERSIONS.privacy, granted: true },
      ...(body.marketingOptIn === undefined
        ? []
        : [{ ...base, type: "marketing" as const, version: LEGAL_VERSIONS.marketing, granted: body.marketingOptIn }]),
    ]);
    return consentStatus(userId);
  }

  return { consentStatus, acceptConsents };
}

export type AccountService = ReturnType<typeof createAccountService>;
