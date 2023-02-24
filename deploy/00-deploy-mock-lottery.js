const { devChains } = require("../hardhat-helper-config");
const { network, ethers } = require("hardhat");

const BASE_FEE = ethers.utils.parseEther("0.25"); //.25 is the premium link per request
const GAS_PRICE_LINK = 1e9; //calc val based on gas price on chains

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const args = [BASE_FEE, GAS_PRICE_LINK];

  if (devChains.includes(network.name)) {
    log("local network detected... deploying mocks");
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    });
    console.log("Deploying Mocks!");
    console.log("----------------");
  }
};

module.exports.tags = ["all", "mocks"];
