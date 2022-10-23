const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle, raffleEntranceFee, deployer;

      beforeEach(async function () {
        console.log("Staging test ...");
        deployer = (await getNamedAccounts()).deployer;
        raffle = await ethers.getContract("Raffle", deployer);
        raffleEntranceFee = await raffle.getEntranceFee();
      });

      describe("fulfillRandomWords", function () {
        it("checks for livechainlink keeper and chainlink VRF", async () => {
          const startingTimeStamp = await raffle.getLastTimeStamp();
          const accounts = await ethers.getSigners();

          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("Winner was picked");
              try {
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerBalance = await accounts[0].getBalance();
                const endingTimeStamp = await raffle.getLastTimeStamp();

                await expect(raffle.getPlayer(0)).to.be.reverted;
                console.log("Players zero");
                assert.equal(recentWinner.toString(), accounts[0].address);
                console.log("account address same!");
                assert.equal(raffleState, 0);
                console.log("Raffle state zero!");
                assert.equal(winnerBalance.toString(), startingBalance.add(raffleEntranceFee).toString());
                console.log("Raffle balance!");
                assert(endingTimeStamp > startingTimeStamp);
                console.log("Raffle end time fine!");
                resolve();
              } catch (e) {
                reject(e);
              }
            });

            const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
            await tx.wait(1);
            console.log("Raffle entered!");
            const startingBalance = await accounts[0].getBalance();
            console.log(startingBalance);
          });
        });
      });
    });
