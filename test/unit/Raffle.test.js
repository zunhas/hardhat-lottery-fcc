const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, raffleInterval;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        accounts = await ethers.getSigners();
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        // const subscriptionId = raffle.getSubscriptionId();
        // await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
        raffleEntranceFee = await raffle.getEntranceFee();
        raffleInterval = await raffle.getInterval();
      });

      describe("constructor", function () {
        it("initializes the raffle state correctly", async function () {
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0");
        });
        it("initializes the raffle interval correctly", async function () {
          assert.equal(raffleInterval.toString(), networkConfig[chainId]["interval"]);
        });
        it("initializes the raffle entrance fee correctly", async function () {
          assert.equal(raffleEntranceFee.toString(), networkConfig[chainId]["entranceFee"]);
        });
        it("initializes the raffle gas lane correctly", async function () {
          const raffleGasLane = await raffle.getGasLane();
          assert.equal(raffleGasLane.toString(), networkConfig[chainId]["gasLane"]);
        });
      });

      describe("enterRaffle", function () {
        it("revert when you dont have enough ETH", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(raffle, "Raffle__NotEnoughETHEntered");
        });

        it("initializes the raffle correctly", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, deployer);
        });

        it("emit events on enter", async function () {
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter");
        });

        it("doesnt allow when calculating", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
          await network.provider.send("evm_increaseTime", [raffleInterval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          // we pretend to be a keeper for a second
          await raffle.performUpkeep([]); // changes the state to calculating for our comparison below
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWithCustomError(
            raffle,
            "Raffle__NotOpen"
          );
        });
      });
      describe("checkUpkeep", function () {
        it("returns false if people havent send any ETH", async function () {
          await network.provider.send("evm_increaseTime", [raffleInterval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          // if u want to simulate a function call and dont want to make a transaction on it
          //use callStatic like below and use the return by saving it in a const variable
          const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
          assert(!upKeepNeeded);
        });
        it("returns false if raffle isnt open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [raffleInterval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          await raffle.performUpkeep([]);
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(raffleState.toString() == "1", upkeepNeeded == false);
        });

        it("returns false if enough time hasnt passed", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [raffleInterval.toNumber() - 5]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns true if enough time hasnt passed, has players eth, and is open ", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [raffleInterval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", function () {
        it("can only run if checkupkeep is true", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [raffleInterval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const tx = await raffle.performUpkeep("0x");
          assert(tx);
        });
        it("reverts if checkup is false", async () => {
          await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(raffle, "Raffle__UpkeepNotNeeded");
        });
        it("updates the raffle state and emits a requestId", async () => {
          // Too many asserts in this test!
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [raffleInterval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const txResponse = await raffle.performUpkeep("0x"); // emits requestId
          const txReceipt = await txResponse.wait(1); // waits 1 block
          const raffleState = await raffle.getRaffleState(); // updates state
          const requestId = txReceipt.events[1].args.requestId;
          assert(requestId.toNumber() > 0);
          assert(raffleState == 1); // 0 = open, 1 = calculating
        });
      });
      describe("fulfillRandomWords", function () {
        beforeEach(async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [raffleInterval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });
        it("can only be called after performupkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
        });
        // This test is too big should be divided into small tests
        // This test simulates users entering the raffle and wraps the entire functionality of the raffle
        // inside a promise that will resolve if everything is successful.
        // An event listener for the WinnerPicked is set up
        // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
        // All the assertions are done once the WinnerPicked event is fired
        it("picks a winner, reset, and sends money", async () => {
          const additionalEntrances = 4;
          const startingIndex = 1;
          for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
            raffle = raffle.connect(accounts[i]);
            await raffle.enterRaffle({ value: raffleEntranceFee });
          }
          const startingTimeStamp = await raffle.getLastTimeStamp();

          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("winner event fired");
              try {
                const recentWinner = await raffle.getRecentWinner();
                console.log(accounts[0].address);
                console.log(accounts[1].address);
                console.log(accounts[2].address);
                console.log(accounts[3].address);
                console.log(accounts[4].address);
                console.log(`winner ${recentWinner} `);
                const raffleState = await raffle.getRaffleState();
                const endingTimeStamp = await raffle.getLastTimeStamp();
                await expect(raffle.getPlayer(0)).to.be.reverted;
                assert.equal(raffleState, 0);
                const winnerBalance = await accounts[1].getBalance();
                assert.equal(
                  winnerBalance.toString(),
                  startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                    .add(raffleEntranceFee.mul(additionalEntrances).add(raffleEntranceFee))
                    .toString()
                );
                assert(endingTimeStamp > startingTimeStamp);
                resolve(); // if try passes, resolves the promise
              } catch (error) {
                reject(error);
              }
            });
            const tx = await raffle.performUpkeep("0x");
            const txReceipt = await tx.wait(1);
            const startingBalance = await accounts[1].getBalance();
            await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address);
          });
        });
      });
    });
