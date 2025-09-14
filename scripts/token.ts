import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getRequiredArg, loadAddresses } from "./utils";

dotenv.config();

async function main() {
  const action = getRequiredArg("--action", "--action");
  const addrs = loadAddresses();
  if (!addrs.ChitToken) throw new Error("Missing ChitToken address. Deploy first.");
  const token = await ethers.getContractAt("ChitToken", addrs.ChitToken);

  if (action === "mint") {
    const to = getRequiredArg("--to", "--to");
    const amount = getRequiredArg("--amount", "--amount");
    const tx = await token.mint(to, amount);
    console.log("mint tx:", tx.hash);
    await tx.wait();
    console.log("Minted", amount, "to", to);
  } else if (action === "approve") {
    const spender = getRequiredArg("--spender", "--spender");
    const amount = getRequiredArg("--amount", "--amount");
    const tx = await token.approve(spender, amount);
    console.log("approve tx:", tx.hash);
    await tx.wait();
    console.log("Approved", amount, "for", spender);
  } else if (action === "balance") {
    const user = getRequiredArg("--user", "--user");
    const bal = await token.balanceOf(user);
    console.log("balance:", bal.toString());
  } else {
    throw new Error(`Unknown action ${action}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

