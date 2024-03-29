require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
	defaultNetwork: "hardhat",
	networks: {
		hardhat: {
			chainId: 31337,
			blockConfirmations: 1,
		},
		localhost: {
			chainId: 31337,
			blockConfirmations: 1,
		},
		goerli: {
			url: GOERLI_RPC_URL,
			accounts: [PRIVATE_KEY],
			chainId: 5,
			blockConfirmations: 6
		}
	},
	etherscan: {
		apiKey: ETHERSCAN_API_KEY
	},
	gasReporter: {
		enabled: false,
		outputFile: "gas-report.txt",
		noColors: true,
		currency: "USD",
		//coinmarketcap: COINMARKETCAP_API_KEY,
		//token: "MATIC"
	},
	solidity: "0.8.17",
	namedAccounts: {
		deployer: {
			default: 0,
		},
		player: {
			default: 1,
		},
	},
	mocha: {
		timeout: 500000,
	},
};
