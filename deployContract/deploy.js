import Web3 from "web3";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function deployfile() {
  try {
    const { abi, bytecode } = JSON.parse(fs.readFileSync("Demo.json"));

    // Connect to local blockchain (Hardhat/Ganache)
    const web3 = new Web3('http://127.0.0.1:8545');
    
    // Test connection
    await web3.eth.getBlockNumber();
    console.log('✅ Connected to local blockchain');
    
    // Get accounts
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts available. Please ensure your blockchain node has funded accounts.');
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

    // AUTO-DETECT constructor parameters from ABI
    const constructorABI = abi.find(item => item.type === 'constructor');
    let deployTx;
    
    if (constructorABI && constructorABI.inputs && constructorABI.inputs.length > 0) {
      console.log(`Constructor requires ${constructorABI.inputs.length} parameter(s):`);
      constructorABI.inputs.forEach((input, index) => {
        console.log(`  ${index + 1}. ${input.name} (${input.type})`);
      });
      
      // GENERATE DEFAULT VALUES based on parameter types
      const defaultArgs = constructorABI.inputs.map(input => {
        switch (input.type) {
          case 'uint256':
          case 'uint':
            return web3.utils.toWei('1', 'ether'); // Default: 1 ETH for amounts
          case 'address':
            return deployerAccount; // Use deployer address as default
          case 'string':
            return `Default${input.name || 'Value'}`; // Default string
          case 'bool':
            return true; // Default boolean
          case 'bytes32':
            return web3.utils.keccak256('default'); // Default bytes32
          default:
            if (input.type.startsWith('uint')) {
              return '1000000'; // Default number for other uint types
            } else if (input.type.startsWith('int')) {
              return '0'; // Default for signed integers
            } else if (input.type.includes('[]')) {
              return []; // Empty array for array types
            }
            return '0'; // Fallback default
        }
      });
      
      console.log('Using default constructor arguments:', defaultArgs);
      deployTx = contract.deploy({
        data: '0x' + bytecode,
        arguments: defaultArgs
      });
    } else {
      console.log('No constructor parameters required');
      deployTx = contract.deploy({ data: '0x' + bytecode });
    }

    // Estimate gas with error handling
    let gasEstimate;
    try {
      gasEstimate = await deployTx.estimateGas({ from: deployerAccount });
    } catch (gasError) {
      console.warn('Gas estimation failed, using default gas limit');
      gasEstimate = 3000000; // Default gas limit
    }

    // Convert BigInt to Number safely
    const gasEstimateNumber = Number(gasEstimate);
    const gasLimit = Math.floor(gasEstimateNumber * 1.3); // Add 30% buffer for safety

    console.log('Estimated gas:', gasEstimateNumber);
    console.log('Gas limit (with buffer):', gasLimit);

    // Get gas price with fallback
    let gasPrice;
    try {
      const gasPriceBigInt = await web3.eth.getGasPrice();
      gasPrice = Number(gasPriceBigInt);
    } catch (gasPriceError) {
      console.warn('Gas price fetch failed, using default');
      gasPrice = 20000000000; // 20 Gwei default
    }

    console.log('Gas price:', web3.utils.fromWei(gasPrice.toString(), 'gwei'), 'Gwei');

    // Calculate total cost
    const totalCost = gasLimit * gasPrice;
    const totalCostEth = web3.utils.fromWei(totalCost.toString(), 'ether');
    console.log('Estimated deployment cost:', totalCostEth, 'ETH');

    // Verify sufficient balance for deployment
    if (parseFloat(balanceInEth) < parseFloat(totalCostEth)) {
      throw new Error(`Insufficient balance for deployment. Required: ${totalCostEth} ETH, Available: ${balanceInEth} ETH`);
    }

    // Deploy contract with retry mechanism
    console.log('Deploying contract...');
    let deployedContract;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        deployedContract = await deployTx.send({
          from: deployerAccount,
          gas: gasLimit,
          gasPrice: gasPrice
        });
        break; // Success, exit retry loop
      } catch (deployError) {
        retryCount++;
        console.warn(`Deployment attempt ${retryCount} failed:`, deployError.message);
        
        if (retryCount >= maxRetries) {
          throw deployError;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`Retrying deployment (${retryCount + 1}/${maxRetries})...`);
      }
    }

    console.log(`✅ Contract deployed successfully!`);
    console.log(`📍 Contract address: ${deployedContract.options.address}`);
    console.log(`🔗 Transaction hash: ${deployedContract.transactionHash}`);
    console.log(`⛽ Gas used: ${deployedContract.gasUsed || 'N/A'}`);

    return deployedContract.options.address;

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    
    // Enhanced error reporting for debugging
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    if (error.receipt) {
      console.error('Transaction receipt:', error.receipt);
    }

    // General error handling without specific error types
    throw new Error(`Contract deployment failed: ${error.message || error.toString()}`);
  }
}

export default deployfile;
