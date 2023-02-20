const { getNamedAccounts, ethers, network } = require("hardhat")
const { getWeth, AMOUNT } = require("./getWeth")
const { wethTokenAddress, networkConfig } = require("../helper-hardhat-config")

async function main() {
    const { deployer } = await getNamedAccounts()

    //Getting WETH
    await getWeth()

    const lendingPool = await getLendingPool(deployer)
    console.log(`[+] LendingPool Address: ${lendingPool.address}`)

    //Giving approval to Aave contract to access the funds
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT)
    //Now deposisting the token to Aave
    console.log("[*] Depositing...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("[+] Deposited")

    //Getting the account Details
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)

    //We have the amount that we can borrow in ETH but we need to convert it to DAI
    const daiPrice = await getDAI()
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
    console.log(`[+] Available to borrow (DAI): ${amountDaiToBorrow}`)

    //Borrow Time
    await borrowDai(
        networkConfig[network.config.chainId]["daiToken"],
        lendingPool,
        amountDaiToBorrowWei,
        deployer
    )
    await getBorrowUserData(lendingPool, deployer)

    //Repay Time
    await repay(
        amountDaiToBorrowWei,
        networkConfig[network.config.chainId]["daiToken"],
        lendingPool,
        deployer
    )
    await getBorrowUserData(lendingPool, deployer)
}

async function getLendingPool(account) {
    //LendingPoolAddressProvider: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
    //Getting LendingPoolAddressesProvider...
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        networkConfig[network.config.chainId]["lendingPoolAddressesProvider"],
        account
    )
    //Getting the Lending Pool Address...
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendingPool
}

async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("[+] Approved!")
}

async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)
    console.log(`[+] Total Collateral Deposited (Wei): ${totalCollateralETH}`)
    console.log(`[+] Total Debt (Wei): ${totalDebtETH}`)
    console.log(`[+] Available to Borrow (Wei): ${availableBorrowsETH}`)
    return { availableBorrowsETH, totalDebtETH }
}

async function getDAI() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[network.config.chainId]["daiEthPriceFeed"]
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`[+] DAI/ETH Price: ${price.toString()}`)
    return price
}

async function borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowInWei, account) {
    const borrowTx = await lendingPool.borrow(
        daiTokenAddress,
        amountDaiToBorrowInWei,
        1,
        0,
        account
    )
    await borrowTx.wait(1)
    console.log("[---]You've Borrowed!!!")
}

async function repay(amount, daiTokenAddress, lendingPool, account) {
    await approveErc20(daiTokenAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiTokenAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log("[+++] You've Repaid!!!")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
