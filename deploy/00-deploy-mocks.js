const { network, ethers, hre } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config.js");

const BASE_FEE = ethers.utils.parseEther("0.25");
const GAS_PRICE_LINK = 1e9;

module.exports = async (hre) => {
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  const args = [BASE_FEE, GAS_PRICE_LINK];

  if (developmentChains.includes(network.name)) {
    console.log("local network...");

    const raffle = await deploy("VRFCoordinatorV2Mock", {
      contract: "VRFCoordinatorV2Mock",
      from: deployer,
      log: true,
      args: args,
    });
    log("Mock deployed ---------------");
  }
};

module.exports.tags = ["all", "mock"];
