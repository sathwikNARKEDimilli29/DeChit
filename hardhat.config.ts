import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim();

// Only use the PRIVATE_KEY if it looks valid (0x + 64 hex chars). Otherwise, omit accounts.
const maybeAccounts = (() => {
  if (!PRIVATE_KEY) return undefined;
  const ok = /^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY);
  if (ok) return [PRIVATE_KEY];
  console.warn("[hardhat.config] Ignoring invalid PRIVATE_KEY (must be 0x + 64 hex chars)");
  return undefined;
})();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    // Use built-in hardhat network by default
    hardhat: {},
    // Example: configure local Anvil/Foundry or Ganache
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      accounts: maybeAccounts
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || ""
  }
};

export default config;
