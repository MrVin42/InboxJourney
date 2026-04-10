import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface SignupLead {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  company?: string;
  workspaceName?: string;
  useCase?: string;
}

export interface CreateSignupLeadInput {
  name: string;
  email: string;
  company?: string;
  workspaceName?: string;
  useCase?: string;
}

const STORE_PATH = path.resolve("data", "signup-leads.json");

export function listSignupLeads(): SignupLead[] {
  if (!existsSync(STORE_PATH)) {
    return [];
  }

  const content = readFileSync(STORE_PATH, "utf8");
  const parsed = JSON.parse(content) as SignupLead[];
  return Array.isArray(parsed) ? parsed : [];
}

export function createSignupLead(input: CreateSignupLeadInput): SignupLead {
  const leads = listSignupLeads();
  const lead: SignupLead = {
    id: `lead-${Date.now()}`,
    createdAt: new Date().toISOString(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company?.trim() || undefined,
    workspaceName: input.workspaceName?.trim() || undefined,
    useCase: input.useCase?.trim() || undefined,
  };

  mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  leads.unshift(lead);
  writeFileSync(STORE_PATH, JSON.stringify(leads, null, 2), "utf8");
  return lead;
}
