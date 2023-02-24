const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { devChains, networkConfig } = require("../../hardhat-helper-config");
const { assert, expect } = require("chai");
!devChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Unit TEst", function () {
      let Lottery, vrfCoordinatorV2Mock, raffleEnteranceFee, deployer, interval;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        Lottery = await ethers.getContract("Lottery", deployer);
        raffleEnteranceFee = await Lottery.getEnteranceFee();
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        interval = await Lottery.getInterval();
      });

      describe("constructor", function () {
        it("initialized values in lottery.sol file correctly", async function () {
          //idealy we want out test to have just 1 assert per "it"
          const raffleState = await Lottery.getRaffleState();
          const interval = await Lottery.getInterval();
          assert.equal(raffleState.toString(), "0");
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });

      describe("enter lottery", function () {
        it("reverts when not enough eth is entered ", async function () {
          await expect(Lottery.enterRaffle()).to.be.revertedWith(
            "Raffle__NotEnoughEthEntered"
          );
        });

        it("adds player to array when they enter with correct parameters", async function () {
          await Lottery.enterRaffle({ value: raffleEnteranceFee });
          const enteredAddress = await Lottery.getPlayer(0);
          assert.equal(enteredAddress, deployer);
        });

        it("emits the correct event if the function suceeds", async function () {
          await expect(
            Lottery.enterRaffle({ value: raffleEnteranceFee })
          ).to.emit(Lottery, "raffleEnter");
        });

        it("doesnt allow enterance when raffle state is in Calculating", async function () {
          await Lottery.enterRaffle({ value: raffleEnteranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          //pretend to be chainlink keeper to run "performUpkeep" function to change the raffle.state to calculating
          await Lottery.performUpkeep([]);
          await expect(
            Lottery.enterRaffle({ value: raffleEnteranceFee })
          ).to.be.revertedWith("Raffle__NotOpen");
        });
      });

      describe("checkUpkeep", function () {
        it("returns false is no one has sent any eth", async function () {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns false if raffle isnt open", async function () {
          await Lottery.enterRaffle({ value: raffleEnteranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await Lottery.performUpkeep([]);
          const raffleState = await Lottery.getRaffleState();
          const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([]);
          assert.equal(raffleState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });

        it("return false if not enough time has passed", async function () {
          await Lottery.enterRaffle({ value: raffleEnteranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([]);
          assert.equal(upkeepNeeded, false);
        });

        it("is true if eth is deposited, enough time has passed, and raffle.state is open", async function () {
          await Lottery.enterRaffle({ value: raffleEnteranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([]);
          assert(upkeepNeeded);
        });
      });
      describe("performUpkeep", function () {
        it("returns true if checkUpkeep is true", async function () {
          await Lottery.enterRaffle({ value: raffleEnteranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);

          const tx = await Lottery.performUpkeep([]);
          assert(tx);
        });

        it("if checkUpkeep is false, should revert with correct error", async function () {
          const tx = Lottery.performUpkeep([]);
          await expect(tx).to.be.revertedWith("Raffle__upkeepNotNeeded");
        });

        it("updates raffle state and emits the correct event", async function () {
          await Lottery.enterRaffle({ value: raffleEnteranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const txResponse = await Lottery.performUpkeep([]);
          const txRecipt = await txResponse.wait(1);
          const requestId = txRecipt.events[1].args.requestId;
          const checkRaffleStatus = await Lottery.getRaffleState();
          assert(checkRaffleStatus.toString() == "1");
          assert(requestId > 0);
        });
      });
      describe("fullfillRandomWords", function () {
        //revert w correct error if unsucessful
        //emit correct event if sucessful
        //make sure payment is sucessful?
        //only goes off is requestRanWords in processUpkeep is called
        beforeEach(async function () {
          await Lottery.enterRaffle({ value: raffleEnteranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
        });
        it("can only be called after performUpkeep", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, Lottery.address)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, Lottery.address)
          ).to.be.revertedWith("nonexistent request");
        });

        //gigantic test
        it("picks a winner, resets lottery, sends money", async function () {
          const additionalEnterances = 3;
          const startingAccountIndex = 1; //deployer is 0
          const accounts = await ethers.getSigners();
          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalEnterances;
            i++
          ) {
            const accountConnectedRaffle = Lottery.connect(accounts[i]);
            await accountConnectedRaffle.enterRaffle({
              value: raffleEnteranceFee,
            });
          }
          const startingTimeStamp = await Lottery.getLatestTimeStamp();
          //run perform upkeep (mock being chainlink keepers)
          //mock being chainlink vrf
          //wait for fullfillRanWords to be called

          //set up listener to wait for fullfillRanWords to emit the `winner picked` event
          await new Promise(async (resolve, reject) => {
            //listener
            Lottery.once("winnerPicked", async () => {
              console.log("event detected!");
              try {
                const recentWinner = await Lottery.getRecentWinner();
                console.log(recentWinner);
                console.log(accounts[0].address);
                console.log(accounts[1].address);
                console.log(accounts[2].address);
                console.log(accounts[3].address);
                const winnerEndingBalance = await accounts[1].getBalance();

                const raffleState = await Lottery.getRaffleState();
                const raffleArray = await Lottery.getNumberOfPlayers();
                const endingTimeStamp = await Lottery.getLatestTimeStamp();
                assert.equal(raffleArray.toString(), "0");
                assert.equal(raffleState.toString(), "0");
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerBeginningBalance.add(
                    raffleEnteranceFee
                      .mul(additionalEnterances)
                      .add(raffleEnteranceFee)
                      .toString()
                  )
                );
                assert(endingTimeStamp > startingTimeStamp);
              } catch (e) {
                reject(e);
              }
              resolve();
            });
            //fire the event
            const tx = await Lottery.performUpkeep([]);
            const txRecipt = await tx.wait(1);
            const winnerBeginningBalance = await accounts[1].getBalance();
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txRecipt.events[1].args.requestId,
              Lottery.address
            );
          });
        });
      });
    });
