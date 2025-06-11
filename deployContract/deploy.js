import Web3 from "web3";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function deployfile() {
  try {
    const { abi, bytecode } = JSON.parse(fs.readFileSync("Demo.json"));

    // Connect to local blockchain
    const web3 = new Web3('http://127.0.0.1:8545');
    
    // Test connection first
    try {
      await web3.eth.getBlockNumber();
      console.log('✅ Connected to local blockchain');
    } catch (connectionError) {
      throw new Error(`Cannot connect to blockchain. Please ensure Ganache is running on port 8545.\n\nStart with: ganache-cli --port 8545`);
    }
    
    // Get accounts
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts available. Please ensure Ganache has funded accounts.');
    }
    
    const deployerAccount = accounts[0];
    console.log('Using deployer account:', deployerAccount);
    
    // Check balance
    const balance = await web3.eth.getBalance(deployerAccount);
    const balanceInEth = web3.utils.fromWei(balance, 'ether');
    console.log('Deployer balance:', balanceInEth, 'ETH');
    
    if (parseFloat(balanceInEth) < 0.01) {
      throw new Error(`Insufficient balance: ${balanceInEth} ETH`);
    }

    // Create contract instance
    const contract = new web3.eth.Contract(abi);
    const deployTx = contract.deploy({ data: '0x' + bytecode });
    
    // FIX: Proper BigInt handling for gas estimation
    const gasEstimate = await deployTx.estimateGas({ from: deployerAccount });
    
    // Convert BigInt to Number explicitly before arithmetic operations
    const gasEstimateNumber = Number(gasEstimate);
    const gasLimit = Math.floor(gasEstimateNumber * 1.2); // Add 20% buffer
    
    console.log('Estimated gas:', gasEstimateNumber);
    console.log('Gas limit (with buffer):', gasLimit);
    
    // Get gas price and handle BigInt conversion
    const gasPriceBigInt = await web3.eth.getGasPrice();
    const gasPrice = Number(gasPriceBigInt);
    
    console.log('Gas price:', web3.utils.fromWei(gasPrice.toString(), 'gwei'), 'Gwei');
    
    // Calculate total cost with proper type handling
    const totalCost = gasLimit * gasPrice;
    const totalCostEth = web3.utils.fromWei(totalCost.toString(), 'ether');
    console.log('Estimated deployment cost:', totalCostEth, 'ETH');
    
    // Deploy with converted values
    console.log('Deploying contract...');
    const deployedContract = await deployTx.send({
      from: deployerAccount,
      gas: gasLimit,        // Now a Number, not BigInt
      gasPrice: gasPrice    // Now a Number, not BigInt
    });
    
    console.log(`✅ Contract deployed at: ${deployedContract.options.address}`);
    console.log(`Transaction hash: ${deployedContract.transactionHash}`);
    
    return deployedContract.options.address;
    
  } catch (error) {
    console.error('Deployment error:', error);
    
    // Provide specific error messages
    if (error.message.includes('BigInt')) {
      throw new Error('BigInt conversion error in gas calculation. This has been fixed in the updated deploy.js');
    } else if (error.message.includes('insufficient funds')) {
      throw new Error('Insufficient funds. Please ensure Ganache accounts are funded.');
    } else if (error.message.includes('connection')) {
      throw new Error('Cannot connect to blockchain. Please start Ganache: ganache-cli --port 8545');
    } else {
      throw error;
    }
  }
}

export default deployfile;
