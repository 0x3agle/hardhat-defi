const { getNamedAccounts, ethers } = require("hardhat")
const { wethTokenAddress } = require("../helper-hardhat-config")
const AMOUNT = ethers.utils.parseEther("0.02")

async function getWeth() {
    const { deployer } = await getNamedAccounts()
    //call the deposit function on weth contract
    //abi, contract address
    //0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
    const iWeth = await ethers.getContractAt("IWeth", wethTokenAddress, deployer)
    const tx = await iWeth.deposit({ value: AMOUNT })
    await tx.wait(1)
    const wethBalance = await iWeth.balanceOf(deployer)
    console.log(`[+] Recieved: ${wethBalance.toString()} WETH`)
}

module.exports = { getWeth, AMOUNT }
