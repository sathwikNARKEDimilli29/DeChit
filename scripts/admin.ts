import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getRequiredArg, loadAddresses } from "./utils";

dotenv.config();

async function main() {
  const action = getRequiredArg("--action", "--action");
  const addrs = loadAddresses();
  if (!addrs.ChitFund) throw new Error("Missing ChitFund address. Deploy first.");

  const fund = await ethers.getContractAt("ChitFund", addrs.ChitFund);

  if (action === "register-operator") {
    const user = getRequiredArg("--address", "--address");
    const tx = await fund.registerOperator(user);
    console.log("registerOperator tx:", tx.hash);
    await tx.wait();
    console.log("Operator registered:", user);
  } else if (action === "register-participant") {
    const user = getRequiredArg("--address", "--address");
    const tx = await fund.registerParticipant(user);
    console.log("registerParticipant tx:", tx.hash);
    await tx.wait();
    console.log("Participant registered:", user);
  } else if (action === "allowlist-protocol") {
    const protocol = getRequiredArg("--protocol", "--protocol");
    const allowed = (getRequiredArg("--allowed", "--allowed").toLowerCase() === "true");
    const tx = await fund.setAllowedProtocol(protocol, allowed);
    console.log("setAllowedProtocol tx:", tx.hash);
    await tx.wait();
    console.log("Protocol:", protocol, "allowed:", allowed);
  } else {
    throw new Error(`Unknown action ${action}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

