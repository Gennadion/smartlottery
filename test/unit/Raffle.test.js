const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat.config");

!developmentChains.includes(network.name)
	? describe.skip
	: describe("Raffle", function () {
			let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
			const chainId = network.config.chainId;

			beforeEach(async function () {
				deployer = (await getNamedAccounts()).deployer;
				await deployments.fixture(["all"]);
				raffle = await ethers.getContract("Raffle", deployer);
				vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
				const subscriptionId = raffle.getSubscriptionId();
				await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
				raffleEntranceFee = await raffle.getEntranceFee();
				interval = await raffle.getInterval();
			});

			describe("constructor", function () {
				it("initializes the raffle correctly", async function () {
					const raffleState = await raffle.getRaffleState();
					assert.equal(raffleState.toString(), "0");
					assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
				});
			});

			describe("enterRaffle", function () {
				it("reverts when you don't pay enough", async function () {
					await expect(raffle.enterRaffle()).to.be.revertedWith(
						"Raffle__NotEnoughETHEntered"
					);
				});
				it("records players when they enter", async function () {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					const playerFromContract = await raffle.getPlayer(0);
					assert.equal(playerFromContract, deployer);
				});
				it("emits event on enter", async function () {
					await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
						raffle,
						"RaffleEnter"
					);
				});
				it("doesn't allow entrance when raffle is calculating", async function () {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					//Pretending Chainlink Keeper
					await raffle.performUpkeep([]);
					await expect(
						raffle.enterRaffle({ value: raffleEntranceFee })
					).to.be.revertedWith("Raffle__NotOpen");
				});
			});

			describe("checkUpkeep", function () {
				it("returns false if people haven't sent any ETH", async function () {
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
					assert(!upkeepNeeded);
				});
				it("returns false if raffle isn't open", async function () {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					await raffle.performUpkeep([]);
					const raffleState = await raffle.getRaffleState();
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
					assert.equal(raffleState.toString(), "1");
					assert.equal(upkeepNeeded, false);
				});
				it("returns false if enough time hasn't passed", async function () {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]);
					await network.provider.request({ method: "evm_mine", params: [] });
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
					assert(!upkeepNeeded);
				});
				it("returns true if enough time has passed, has players, eth and is open", async function () {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.request({ method: "evm_mine", params: [] });
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
					assert(upkeepNeeded);
				});
			});
			describe("performUpkeep", function () {
				it("it can only run if checkupkeep is true", async function () {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					const tx = await raffle.performUpkeep([]);
					assert(tx);
				});
				it("reverts when checkupkeep is false", async function () {
					await expect(raffle.performUpkeep([])).to.be.revertedWith(
						"Raffle__UpkeepNotNeeded"
					);
				});
				it("updates the raffle state, emits and event, and calls the vrf coordinator", async function () {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
					const txResponse = await raffle.performUpkeep([]);
					const txReceipt = await txResponse.wait(1);
					const requestId = txReceipt.events[1].args.requestId;
					const raffleState = await raffle.getRaffleState();
					assert(requestId.toNumber() > 0);
					assert(raffleState.toString() === "1");
				});
			});
			describe("fulfillRandomWords", function () {
				beforeEach(async function () {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
					await network.provider.send("evm_mine", []);
				});
				it("can only be called after performUpkeep", async function () {
					await expect(
						vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
					).to.be.revertedWith("nonexistent request");
					await expect(
						vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
					).to.be.revertedWith("nonexistent request");
				});

				it("picks a winner, resets the lottery and sends money", async function () {
					const additionalEntrants = 3;
					const startingAccountIndex = 1; //since deployer is 0
					const accounts = await ethers.getSigners();
					for (
						let i = startingAccountIndex;
						i < startingAccountIndex + additionalEntrants;
						i++
					) {
						const accountConnectedRaffle = raffle.connect(accounts[i]);
						await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
					}
					const startingTimeStamp = await raffle.getLatestTimeStamp();
					await new Promise(async (resolve, reject) => {
						console.log("Event found!");
						raffle.once("WinnerPicked", async () => {
							try {
								const recentWinner = await raffle.getRecentWinner();
								console.log(recentWinner);
								const raffleState = await raffle.getRaffleState();
								const endingTimeStamp = await raffle.getLatestTimeStamp();
								const numPlayers = await raffle.getNumberOfPlayers();
								const winnerEndingBalance = await accounts[1].getBalance();
								assert.equal(numPlayers.toString(), "0");
								assert.equal(raffleState.toString(), "0");
								assert(endingTimeStamp > startingTimeStamp);

								assert.equal(
									winnerEndingBalance.toString(),
									winnerStartingBalance.add(
										raffleEntranceFee
											.mul(additionalEntrants)
											.add(raffleEntranceFee)
											.toString()
									)
								);
								resolve();
							} catch (e) {
								reject(e);
							}
						});

						// Setting up listener
						// Below we fire the event and listener picks it up, and resolve
						const tx = await raffle.performUpkeep([]);
						const txReceipt = await tx.wait(1);
						const winnerStartingBalance = await accounts[1].getBalance();
						await vrfCoordinatorV2Mock.fulfillRandomWords(
							txReceipt.events[1].args.requestId.toString(),
							raffle.address
						);
					});
				});
			});
	  });
