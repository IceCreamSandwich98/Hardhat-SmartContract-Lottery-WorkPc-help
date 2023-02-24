const { network } = require("hardhat");
const {
  devChains,
  networkConfig,
  enteranceFee,
  gasLane,
  subscriptionId,
  callbackGasLimit,
  interval,
} = require("../hardhat-helper-config");
const { verify } = require("../utils/verify");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = network.config.chainId;
  const SUB_FUND_AMOUNT = ethers.utils.parseEther("2");

  let vrfCoordinatorV2Address, subScriptionId;

  if (devChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );

    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
    const transactionRecipt = await transactionResponse.wait(1);
    subScriptionId = transactionRecipt.events[0].args.subId;
    //fund subscription
    await vrfCoordinatorV2Mock.fundSubscription(
      subScriptionId,
      SUB_FUND_AMOUNT
    );
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subScriptionId = networkConfig[chainId]["subscriptionId"];
  }

  const gasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const enteranceFee = networkConfig[chainId]["enteranceFee"];

  const args = [
    vrfCoordinatorV2Address,
    enteranceFee,
    gasLane,
    subScriptionId,
    gasLimit,
    interval,
  ];

  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (!devChains.includes(network.name) && ETHERSCAN_API_KEY) {
    log("Verifying...");
    await verify(lottery.address, args);
  }
  log("---------------------------------------");
};

module.exports.tags = ["all", "raffle"];
