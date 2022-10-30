const { ethers, network } = require("hardhat");
const { readFileSync } = require("fs");
const { writeFileSync } = require("fs");

const FRONTEND_ADDRESSES_FILE = "../nextjs-smartcontract-lottery/constants/contractAddresses.json";
const FRONTEND_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json";
module.exports = async function () {
  if (process.env.UPDATE_FRONTEND) {
    console.log("updating front end ...");
    updateContractAddress();
    updateAbi();
  }
};

async function updateAbi() {
  const raffle = await ethers.getContract("Raffle");
  writeFileSync(FRONTEND_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json));
  console.log("updating abi in front end ...");
}

async function updateContractAddress() {
  const raffle = await ethers.getContract("Raffle");
  const file = readFileSync(FRONTEND_ADDRESSES_FILE, "utf8");
  const contractAddresses = JSON.parse(file);
  const chainId = network.config.chainId.toString();

  if (chainId in contractAddresses) {
    if (!contractAddresses[chainId].includes(raffle.address)) {
      contractAddresses[chainId].push(raffle.address);
      console.log("updating if chainId exists but no address ...");
    }
  } else {
    contractAddresses[chainId] = [raffle.address];
    console.log("updating new chain id and address ...");
  }
  writeFileSync(FRONTEND_ADDRESSES_FILE, JSON.stringify(contractAddresses));
  console.log("updating file in front end ...");
}

module.exports.tags = ["all", "frontend"];
