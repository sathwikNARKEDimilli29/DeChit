import { expect } from "chai";
import { ethers } from "hardhat";

const SCALE = 10n ** 18n;

describe("CreditScoreOracle", () => {
  async function deploy() {
    const [deployer, a, b, c] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("CreditScoreOracle");
    const oracle = await Oracle.deploy(deployer.address);
    await oracle.waitForDeployment();
    return { deployer, a, b, c, oracle };
  }

  it("sets roles and enforces access", async () => {
    const { deployer, a, oracle } = await deploy();
    const ORACLE_ROLE = await oracle.ORACLE_ROLE();
    const DEFAULT_ADMIN_ROLE = await oracle.DEFAULT_ADMIN_ROLE();
    expect(await oracle.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.eq(true);
    expect(await oracle.hasRole(ORACLE_ROLE, deployer.address)).to.eq(true);

    await expect(oracle.connect(a).setTrust(deployer.address, SCALE))
      .to.be.revertedWithCustomError(oracle, "AccessControlUnauthorizedAccount");
  });

  it("records trust and updates sums/inbound", async () => {
    const { deployer, a, oracle } = await deploy();
    // deployer has ORACLE_ROLE and acts as 'from'
    await oracle.setTrust(a.address, SCALE / 2n);
    expect(await oracle.trustWeight(deployer.address, a.address)).to.eq(SCALE / 2n);
    expect(await oracle.outWeightSum(deployer.address)).to.eq(SCALE / 2n);
    const inbound = await oracle.inboundTrusters(a.address, 0);
    expect(inbound).to.eq(deployer.address);

    // Update weight should adjust out sum
    await oracle.setTrust(a.address, SCALE);
    expect(await oracle.outWeightSum(deployer.address)).to.eq(SCALE);

    // Set to zero reduces sum
    await oracle.setTrust(a.address, 0n);
    expect(await oracle.outWeightSum(deployer.address)).to.eq(0n);
  });

  it("bayesian reputation and payment scores", async () => {
    const { deployer, a, oracle } = await deploy();

    // Default bayes 0.5
    expect(await oracle.bayesianReputation(a.address)).to.eq(SCALE / 2n);

    await oracle.recordOutcome(a.address, true);
    await oracle.recordOutcome(a.address, true);
    expect(await oracle.bayesianReputation(a.address)).to.eq(SCALE); // 1.0

    await oracle.recordPaymentStats(a.address, true, 0);
    await oracle.recordPaymentStats(a.address, true, 0);
    expect(await oracle.paymentFrequency(a.address)).to.eq(SCALE);
    expect(await oracle.inverseDelayScore(a.address)).to.eq(SCALE);
  });

  it("pageRank and aggregate score compute", async () => {
    const { deployer, a, b, oracle } = await deploy();
    // Simple trust: deployer -> a with full weight, gives inbound to a
    await oracle.setTrust(a.address, SCALE);
    const d = await oracle.dampingFactor();
    const pr = await oracle.pageRank(a.address);
    // Rank is >= (1-d)*SCALE
    expect(pr).to.be.gte(SCALE - d);

    const score = await oracle.computeCreditScore(a.address);
    // Score should be within [0, SCALE]
    expect(score).to.be.gte(0n);
    expect(score).to.be.lte(SCALE);

    // No inbound for b -> smallish base rank
    const prB = await oracle.pageRank(b.address);
    expect(prB).to.eq(SCALE - d);
  });
});
