const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { devChains, networkConfig } = require("../../hardhat-helper-config");
const { assert, expect } = require("chai");
const { isAddress } = require("ethers/lib/utils");
devChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Staging Test", function () {
      let Lottery, raffleEnteranceFee, deployer;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        Lottery = await ethers.getContract("Lottery", deployer);
        raffleEnteranceFee = await Lottery.getEnteranceFee();
      });

      describe("fullfillRandomWords", function () {
        it("works with live chainlink keepers, chainlink vrf, get randwinner", async function () {
          //enter raffle
          const startingTimeStamp = await Lottery.getLastestTimeStamp();
          const accounts = await ethers.getSigners();
          await new Promise(async (resolve, reject) => {
            Lottery.once("WinnerPicked", async () => {
              console.log("winner picked!! event fired");
              try {
                const recentWinner = await Lottery.getRecentWinner();
                const raffleState = await Lottery.getRaffleState();
                const winnerEndingBalance = await accounts[0].getBalance();
                const endingTimeStamp = await Lottery.getLastestTimeStamp();

                await expect(Lottery.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(raffleState.toString(), "0");
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(raffleEnteranceFee.toString())
                );
                assert(endingTimeStamp > startingTimeStamp);
                resolve();

                //asserts
              } catch (error) {
                console.log(error);
                reject(e);
              }
            });
            await Lottery.enterRaffle({ value: raffleEnteranceFee });
            const winnerStartingBalance = await accounts[0].getBalance();
          });
        });
      });
    });
