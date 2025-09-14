import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getRequiredArg, loadAddresses } from "./utils";

dotenv.config();

async function main() {
  const addrs = loadAddresses();
  if (!addrs.ChitFund) throw new Error("Missing ChitFund address. Deploy first.");
  const fund = await ethers.getContractAt("ChitFund", addrs.ChitFund);

  const to = getRequiredArg("--to", "--to");
  const amount = getRequiredArg("--amount", "--amount");
  const tx = await fund.tradeTokens(to, amount);
  console.log("tradeTokens tx:", tx.hash);
  await tx.wait();
  console.log("Traded", amount, "to", to);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

