import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { saveAddresses } from "./utils";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const tokenName = process.env.TOKEN_NAME || "ChitToken";
  const tokenSymbol = process.env.TOKEN_SYMBOL || "CHIT";
  const tokenSupply = process.env.TOKEN_SUPPLY || (1000000n * 10n ** 18n).toString();

  const poolSizeCap = process.env.POOL_SIZE_CAP || (100000n * 10n ** 18n).toString();
  // 0.70 * 1e18 by default
  const minCreditForLarge = process.env.MIN_CREDIT_LARGE || ((10n ** 18n) * 7n / 10n).toString();
  const minOperatorRating = parseInt(process.env.MIN_OPERATOR_RATING || "3", 10);

  console.log("Deploying CreditScoreOracle...");
  const Oracle = await ethers.getContractFactory("CreditScoreOracle");
  const oracle = await Oracle.deploy(deployer.address);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("CreditScoreOracle:", oracleAddr);

  console.log("Deploying ChitToken...");
  const Token = await ethers.getContractFactory("ChitToken");
  const token = await Token.deploy(tokenName, tokenSymbol, tokenSupply, deployer.address);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("ChitToken:", tokenAddr);

  console.log("Deploying ChitFund...");
  const Fund = await ethers.getContractFactory("ChitFund");
  const fund = await Fund.deploy(
    deployer.address,
    tokenAddr,
    oracleAddr,
    poolSizeCap,
    minCreditForLarge,
    minOperatorRating
  );
  await fund.waitForDeployment();
  const fundAddr = await fund.getAddress();
  console.log("ChitFund:", fundAddr);

  saveAddresses({
    ChitToken: tokenAddr,
    CreditScoreOracle: oracleAddr,
    ChitFund: fundAddr,
  });

  console.log("Saved addresses to deployments/last-deploy.json");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
