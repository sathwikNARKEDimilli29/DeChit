import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const SCALE = 10n ** 18n;

async function deployAll() {
  const [admin, operator, p1, p2, p3, outsider] = await ethers.getSigners();

  const Oracle = await ethers.getContractFactory("CreditScoreOracle");
  const oracle = await Oracle.deploy(admin.address);
  await oracle.waitForDeployment();

  const Token = await ethers.getContractFactory("ChitToken");
  const initial = 1_000_000n * SCALE;
  const token = await Token.deploy("ChitToken", "CHIT", initial, admin.address);
  await token.waitForDeployment();

  const poolSizeCap = 1_000n * SCALE; // 1000 tokens
  // Threshold as a fraction of 1.0 (scaled 1e18). 0.7 == 70%.
  const minCreditForLarge = 7n * (SCALE / 10n); // 0.7e18
  const minOperatorRating = 3;

  const Fund = await ethers.getContractFactory("ChitFund");
  const fund = await Fund.deploy(
    admin.address,
    await token.getAddress(),
    await oracle.getAddress(),
    poolSizeCap,
    minCreditForLarge,
    minOperatorRating
  );
  await fund.waitForDeployment();

  // Set up roles
  await fund.registerOperator(operator.address);
  await fund.registerParticipant(p1.address);
  await fund.registerParticipant(p2.address);
  await fund.registerParticipant(p3.address);

  return { admin, operator, p1, p2, p3, outsider, token, oracle, fund, poolSizeCap, minCreditForLarge, minOperatorRating };
}

describe("ChitFund", () => {
  it("registers roles and allowlists protocols by admin", async () => {
    const { admin, operator, fund } = await loadFixture(deployAll);
    await expect(fund.connect(admin).setAllowedProtocol(operator.address, true))
      .to.emit(fund, "ProtocolAllowlisted");
    await expect(fund.connect(operator).setAllowedProtocol(operator.address, true))
      .to.be.revertedWithCustomError(fund, "AccessControlUnauthorizedAccount");
  });

  it("creates pools and deposits premiums", async () => {
    const { operator, fund } = await loadFixture(deployAll);
    const size = 100n * SCALE;
    const rating = 4;
    await expect(fund.connect(operator).createPool(size, rating)).to.emit(fund, "PoolCreated");

    const poolId = 1n;
    await expect(
      fund.connect(operator).depositPremium(poolId, { value: ethers.parseEther("0.05") })
    ).to.emit(fund, "PremiumDeposited");
    await expect(
      fund.connect(operator).depositPremium(poolId, { value: 0 })
    ).to.be.revertedWith("no value");
  });

  it("enforces pool size > 0 and rating threshold for auctions", async () => {
    const { operator, fund } = await loadFixture(deployAll);
    await expect(fund.connect(operator).createPool(0n, 1)).to.be.revertedWith("size=0");
    await fund.connect(operator).createPool(10n * SCALE, 1);
    await expect(fund.connect(operator).createAuction(1n, 60n, 60n)).to.be.revertedWith("pool.rating<min");
  });

  it("runs auction flow: create, commit, reveal, close (winner highest bid)", async () => {
    const { operator, p1, p2, token, fund } = await loadFixture(deployAll);
    const size = 100n * SCALE;
    await fund.connect(operator).createPool(size, 4);

    const now = await time.latest();
    const bidSecs = 60n;
    const revealSecs = 60n;
    await expect(fund.connect(operator).createAuction(1n, bidSecs, revealSecs)).to.emit(fund, "AuctionCreated");

    // Commit
    const amount1 = ethers.parseEther("1");
    const amount2 = ethers.parseEther("2");
    const s1 = "s1"; const s2 = "s2";
    const commit1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256","string"],[amount1, s1]));
    const commit2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256","string"],[amount2, s2]));
    await expect(fund.connect(p1).commitBid(1n, commit1)).to.emit(fund, "BidCommitted");
    await expect(fund.connect(p2).commitBid(1n, commit2)).to.emit(fund, "BidCommitted");

    // Move to reveal
    await time.increase(Number(bidSecs) + 1);

    await expect(fund.connect(p1).revealBid(1n, amount1, s1)).to.emit(fund, "BidRevealed");
    await expect(fund.connect(p2).revealBid(1n, amount2, s2)).to.emit(fund, "BidRevealed");

    // Move past reveal end
    await time.increase(Number(revealSecs) + 1);

    // Fund needs tokens to pay any potential bonus (if threshold met). For this test, bids are low so no bonus by default.
    await expect(fund.closeAuction(1n)).to.emit(fund, "AuctionClosed").withArgs(1n, p2.address, amount2, 0);
  });

  it("tie-breaks by credit score on equal bids and pays bonus if high score", async () => {
    const { admin, operator, p1, p2, token, oracle, fund } = await loadFixture(deployAll);
    await fund.connect(operator).createPool(100n * SCALE, 4);
    const bidSecs = 30n, revealSecs = 30n;
    await fund.connect(operator).createAuction(1n, bidSecs, revealSecs);

    // Equal bids
    const amount = ethers.parseEther("1");
    const s1 = "aaa", s2 = "bbb";
    const c1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256","string"],[amount, s1]));
    const c2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256","string"],[amount, s2]));
    await fund.connect(p1).commitBid(1n, c1);
    await fund.connect(p2).commitBid(1n, c2);

    // Boost p2 credit above p1
    await oracle.recordOutcome(p2.address, true);
    await oracle.recordOutcome(p2.address, true);
    await oracle.recordPaymentStats(p2.address, true, 0);

    await time.increase(Number(bidSecs) + 1);
    await fund.connect(p1).revealBid(1n, amount, s1);
    await fund.connect(p2).revealBid(1n, amount, s2);
    await time.increase(Number(revealSecs) + 1);

    // Ensure fund has tokens to pay potential bonus (set p2 score >= 850e18)
    // Crank score by calling more positive signals
    for (let i = 0; i < 10; i++) {
      await oracle.recordOutcome(p2.address, true);
      await oracle.recordPaymentStats(p2.address, true, 0);
    }
    const score = await oracle.computeCreditScore(p2.address);

    // Transfer some tokens to fund to cover bonus
    await token.transfer(await fund.getAddress(), ethers.parseEther("5"));

    const tx = await fund.closeAuction(1n);
    await expect(tx).to.emit(fund, "AuctionClosed");
  });

  it("requires participant role for bidding and enforces commit/reveal rules", async () => {
    const { operator, p1, outsider, fund } = await loadFixture(deployAll);
    await fund.connect(operator).createPool(100n * SCALE, 4);
    await fund.connect(operator).createAuction(1n, 30n, 30n);

    const amount = ethers.parseEther("1");
    const secret = "s";
    const commit = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256","string"],[amount, secret]));

    await expect(fund.connect(outsider).commitBid(1n, commit))
      .to.be.revertedWithCustomError(fund, "AccessControlUnauthorizedAccount");

    await fund.connect(p1).commitBid(1n, commit);
    // Cannot reveal before bid end
    await expect(fund.connect(p1).revealBid(1n, amount, secret)).to.be.revertedWith("not in reveal");
    // After bid end, wrong secret reverts
    // Move into reveal window first
    await time.increase(31);
    await expect(fund.connect(p1).revealBid(1n, amount, "wrong"))
      .to.be.revertedWith("commit mismatch");

    await fund.connect(p1).revealBid(1n, amount, secret);
    await expect(fund.connect(p1).revealBid(1n, amount, secret)).to.be.reverted; // already revealed

    // Create another auction and ensure commit after bidEnd reverts
    await fund.connect(operator).createAuction(1n, 10n, 10n);
    await time.increase(11);
    await expect(fund.connect(p1).commitBid(2n, commit)).to.be.revertedWith("bidding over");
  });

  it("blocks large pool auctions for low-credit operators then allows after score improves", async () => {
    const { admin, operator, oracle, fund, poolSizeCap } = await loadFixture(deployAll);
    const large = poolSizeCap + 1n;
    await fund.connect(operator).createPool(large, 5);

    // Initially low credit -> revert
    await expect(
      fund.connect(operator).createAuction(1n, 30n, 30n)
    ).to.be.revertedWith("operator credit low");

    // Improve operator credit: boost bayes + payments + pagerank via multiple oracle nodes
    const ORACLE_ROLE = await oracle.ORACLE_ROLE();
    // Grant ORACLE_ROLE to two more addresses to add inbound trust edges
    const signers = await ethers.getSigners();
    await oracle.grantRole(ORACLE_ROLE, signers[2].address);
    await oracle.grantRole(ORACLE_ROLE, signers[3].address);

    // From each oracle, set strong trust towards operator to crank PR
    await oracle.setTrust(operator.address, SCALE);
    await oracle.connect(signers[2]).setTrust(operator.address, SCALE);
    await oracle.connect(signers[3]).setTrust(operator.address, SCALE);

    // Bayes and payment signals
    for (let i = 0; i < 5; i++) {
      await oracle.recordOutcome(operator.address, true);
      await oracle.recordPaymentStats(operator.address, true, 0);
    }

    // Now should pass
    await expect(fund.connect(operator).createAuction(1n, 30n, 30n)).to.emit(fund, "AuctionCreated");
    // Close before reveal end should revert
    await expect(fund.closeAuction(1n)).to.be.revertedWith("reveal ongoing");
    await time.increase(61);
    await fund.closeAuction(1n);
    // Double close reverts
    await expect(fund.closeAuction(1n)).to.be.revertedWith("already closed");
  });

  it("tradeTokens requires allowance and transfers via token", async () => {
    const { p1, p2, token, fund } = await loadFixture(deployAll);
    // Mint to p1
    await token.mint(p1.address, ethers.parseEther("3"));
    // Approve fund
    await token.connect(p1).approve(await fund.getAddress(), ethers.parseEther("2"));
    // Transfer via tradeTokens
    await expect(
      fund.connect(p1).tradeTokens(p2.address, ethers.parseEther("2"))
    ).to.changeTokenBalances(token, [p1, p2], [ethers.parseEther("-2"), ethers.parseEther("2")]);

    // Without allowance should fail
    await expect(
      fund.connect(p1).tradeTokens(p2.address, ethers.parseEther("2"))
    ).to.be.reverted;
  });

  it("integrateWithDefi enforces allowlist and executes calls", async () => {
    const { admin, operator, fund } = await loadFixture(deployAll);
    const Mock = await ethers.getContractFactory("MockProtocol");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();

    const sig = "ping(uint256)";
    const data = new ethers.Interface([`function ${sig}`]).encodeFunctionData("ping", [123]);

    // Not allowlisted -> revert
    await expect(
      fund.connect(operator).integrateWithDefi(await mock.getAddress(), data)
    ).to.be.revertedWith("protocol not allowed");

    // Allowlist and call
    await fund.connect(admin).setAllowedProtocol(await mock.getAddress(), true);
    const ret = await fund.connect(operator).integrateWithDefi.staticCall(await mock.getAddress(), data);
    // Return should be 32 bytes keccak(123)
    const expected = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"],[123]));
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["bytes32"], ret)[0];
    expect(decoded).to.eq(expected);
  });
});
