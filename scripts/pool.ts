import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getRequiredArg, loadAddresses } from "./utils";

dotenv.config();

async function main() {
  const action = getRequiredArg("--action", "--action");
  const addrs = loadAddresses();
  if (!addrs.ChitFund) throw new Error("Missing ChitFund address. Deploy first.");
  const fund = await ethers.getContractAt("ChitFund", addrs.ChitFund);

  if (action === "create-pool") {
    const size = getRequiredArg("--size", "--size");
    const rating = parseInt(getRequiredArg("--rating", "--rating"), 10);
    const tx = await fund.createPool(size, rating);
    console.log("createPool tx:", tx.hash);
    const rcpt = await tx.wait();
    console.log("Pool created. Check events for poolId.");
  } else if (action === "deposit-premium") {
    const poolId = BigInt(getRequiredArg("--poolId", "--poolId"));
    const value = getRequiredArg("--value", "--value");
    const tx = await fund.depositPremium(poolId, { value });
    console.log("depositPremium tx:", tx.hash);
    await tx.wait();
    console.log("Premium deposited for pool:", poolId.toString());
  } else {
    throw new Error(`Unknown action ${action}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

