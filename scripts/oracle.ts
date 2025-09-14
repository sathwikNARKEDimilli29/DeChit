import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getRequiredArg, loadAddresses } from "./utils";

dotenv.config();

async function main() {
  const action = getRequiredArg("--action", "--action");
  const addrs = loadAddresses();
  if (!addrs.CreditScoreOracle) throw new Error("Missing CreditScoreOracle address. Deploy first.");
  const oracle = await ethers.getContractAt("CreditScoreOracle", addrs.CreditScoreOracle);

  if (action === "set-trust") {
    const to = getRequiredArg("--to", "--to");
    const weight = getRequiredArg("--weight", "--weight");
    const tx = await oracle.setTrust(to, weight);
    console.log("setTrust tx:", tx.hash);
    await tx.wait();
    console.log("Trust set ->", to, "weight:", weight);
  } else if (action === "record-outcome") {
    const user = getRequiredArg("--user", "--user");
    const success = (getRequiredArg("--success", "--success").toLowerCase() === "true");
    const tx = await oracle.recordOutcome(user, success);
    console.log("recordOutcome tx:", tx.hash);
    await tx.wait();
    console.log("Outcome recorded for:", user, "success:", success);
  } else if (action === "record-payment") {
    const user = getRequiredArg("--user", "--user");
    const onTime = (getRequiredArg("--onTime", "--onTime").toLowerCase() === "true");
    const delay = getRequiredArg("--delaySeconds", "--delaySeconds");
    const tx = await oracle.recordPaymentStats(user, onTime, delay);
    console.log("recordPaymentStats tx:", tx.hash);
    await tx.wait();
    console.log("Payment stats recorded for:", user);
  } else if (action === "compute") {
    const user = getRequiredArg("--user", "--user");
    const score = await oracle.computeCreditScore(user);
    console.log("creditScore:", score.toString());
  } else if (action === "page-rank") {
    const user = getRequiredArg("--user", "--user");
    const pr = await oracle.pageRank(user);
    console.log("pageRank:", pr.toString());
  } else {
    throw new Error(`Unknown action ${action}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

