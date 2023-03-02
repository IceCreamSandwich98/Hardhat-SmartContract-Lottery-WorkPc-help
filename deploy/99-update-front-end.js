const { ethers } = require("hardhat");

const fs = require("fs");

const FRONT_END_ADDRESS_LOCATION =
  "../next-js-smartcontract-lottery-frontend/constants/contractAddresses.json";

const FRONT_END_ABI_LOCATION =
  "../next-js-smartcontract-lottery-frontend/constants/abi.json";

module.exports = async function () {
  if (process.env.UPDATE_FRONT_END) {
    console.log("Updating front end");

    updateContractAddresses();
    updateAbi();
  }
};

async function updateAbi() {
  const raffle = await ethers.getContract("Lottery");
  fs.writeFileSync(
    FRONT_END_ABI_LOCATION,
    raffle.interface.format(ethers.utils.FormatTypes.json)
  );
}

async function updateContractAddresses() {
  const chainId = network.config.chainId.toString();
  const raffle = await ethers.getContract("Lottery");
  const currentAddresses = JSON.parse(
    fs.readFileSync(FRONT_END_ADDRESS_LOCATION, "utf8")
  );
  if (chainId in currentAddresses) {
    if (!currentAddresses[chainId].includes(raffle.address)) {
      currentAddresses[chainId].push(raffle.address);
    }
  }
  {
    currentAddresses[chainId] = [raffle.address];
  }
  fs.writeFileSync(
    FRONT_END_ADDRESS_LOCATION,
    JSON.stringify(currentAddresses)
  );
}

module.exports.tags = ["all", "frontend"];
