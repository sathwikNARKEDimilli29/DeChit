import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { getRequiredArg, loadAddresses } from "./utils";

dotenv.config();

async function main() {
  const action = getRequiredArg("--action", "--action");
  const addrs = loadAddresses();
  if (!addrs.ChitFund) throw new Error("Missing ChitFund address. Deploy first.");
  const fund = await ethers.getContractAt("ChitFund", addrs.ChitFund);

  if (action === "create") {
    const poolId = BigInt(getRequiredArg("--poolId", "--poolId"));
    const bidSecs = BigInt(getRequiredArg("--bidSecs", "--bidSecs"));
    const revealSecs = BigInt(getRequiredArg("--revealSecs", "--revealSecs"));
    const tx = await fund.createAuction(poolId, bidSecs, revealSecs);
    console.log("createAuction tx:", tx.hash);
    await tx.wait();
    console.log("Auction created. Check events for auctionId.");
  } else if (action === "commit") {
    const auctionId = BigInt(getRequiredArg("--auctionId", "--auctionId"));
    const amount = BigInt(getRequiredArg("--amount", "--amount"));
    const secret = getRequiredArg("--secret", "--secret");
    const commitHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "string"], [amount, secret]));
    const tx = await fund.commitBid(auctionId, commitHash);
    console.log("commitBid tx:", tx.hash);
    await tx.wait();
    console.log("Bid committed for auction:", auctionId.toString());
  } else if (action === "reveal") {
    const auctionId = BigInt(getRequiredArg("--auctionId", "--auctionId"));
    const amount = BigInt(getRequiredArg("--amount", "--amount"));
    const secret = getRequiredArg("--secret", "--secret");
    const tx = await fund.revealBid(auctionId, amount, secret);
    console.log("revealBid tx:", tx.hash);
    await tx.wait();
    console.log("Bid revealed for auction:", auctionId.toString());
  } else if (action === "close") {
    const auctionId = BigInt(getRequiredArg("--auctionId", "--auctionId"));
    const tx = await fund.closeAuction(auctionId);
    console.log("closeAuction tx:", tx.hash);
    await tx.wait();
    console.log("Auction closed:", auctionId.toString());
  } else {
    throw new Error(`Unknown action ${action}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

