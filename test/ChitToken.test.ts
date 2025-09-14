import { expect } from "chai";
import { ethers } from "hardhat";

describe("ChitToken", () => {
  it("deploys with roles and initial supply", async () => {
    const [deployer, user] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("ChitToken");
    const initial = 1_000_000n * 10n ** 18n;
    const token = await Token.deploy("ChitToken", "CHIT", initial, deployer.address);
    await token.waitForDeployment();

    const bal = await token.balanceOf(deployer.address);
    expect(bal).to.equal(initial);

    const MINTER_ROLE = await token.MINTER_ROLE();
    const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();

    expect(await token.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.eq(true);
    expect(await token.hasRole(MINTER_ROLE, deployer.address)).to.eq(true);

    await expect(token.connect(user).mint(user.address, 1n))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");

    await expect(token.mint(user.address, 5n)).to.emit(token, "Transfer");
    expect(await token.balanceOf(user.address)).to.equal(5n);
  });
});
