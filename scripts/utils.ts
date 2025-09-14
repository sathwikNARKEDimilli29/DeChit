import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

type Addresses = {
  ChitToken?: string;
  CreditScoreOracle?: string;
  ChitFund?: string;
};

const DEPLOY_DIR = path.join(process.cwd(), "deployments");
const ADDR_FILE = path.join(DEPLOY_DIR, "last-deploy.json");

export function ensureDeployDir() {
  if (!fs.existsSync(DEPLOY_DIR)) fs.mkdirSync(DEPLOY_DIR, { recursive: true });
}

export function saveAddresses(addrs: Addresses) {
  ensureDeployDir();
  fs.writeFileSync(ADDR_FILE, JSON.stringify(addrs, null, 2));
}

export function loadAddresses(): Addresses {
  try {
    const raw = fs.readFileSync(ADDR_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getDeployer() {
  const [signer] = await ethers.getSigners();
  return signer;
}

export function reqEnv(name: string, def?: string): string {
  const v = process.env[name] ?? def;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

export function parseBool(v?: string): boolean {
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export function getArg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}

export function getRequiredArg(flag: string, name?: string): string {
  const v = getArg(flag);
  if (!v) throw new Error(`Missing required arg ${name ?? flag}`);
  return v;
}

