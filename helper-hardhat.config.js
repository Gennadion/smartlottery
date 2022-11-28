const { ethers } = require("hardhat");

const networkConfig = {
	5: {
		name: "goerli",
		vrfCoordinatorV2: "0x2bce784e69d2ff36c71edcb9f88358db0dfb55b4",
		entranceFee: ethers.utils.parseEther("0.01"),
		gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
		subscriptionId: "7032",
		callbackGasLimit: "1000000",
		interval: "30",
	},
	31337: {
		name: "hardhat",
		entranceFee: ethers.utils.parseEther("0.01"),
		gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
		callbackGasLimit: "50000",
		interval: "30",
	},
};

const developmentChains = ["hardhat", "localhost"];

module.exports = {
	networkConfig,
	developmentChains,
};
