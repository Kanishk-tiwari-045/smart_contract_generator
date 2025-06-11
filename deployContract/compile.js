import fs from "fs/promises";
import solc from "solc";

async function compilefile(sourceCode, contractName) {
  try {
    console.log("Compiling contract:", contractName);
    console.log("Source code length:", sourceCode.length);
    console.log("First 100 chars:", sourceCode.substring(0, 100));
    
    // Clean the source code and remove any language prefixes or unwanted characters
    let cleanedSourceCode = sourceCode
      .replace(/^solidity\s*/, '')        // Remove "solidity" prefix if present
      .replace(/^javascript\s*/, '')      // Remove "javascript" prefix if present
      .replace(/\r\n/g, '\n')            // Normalize Windows line endings
      .replace(/\r/g, '\n')              // Handle old Mac line endings
      .replace(/^\s*\n/, '')             // Remove leading empty lines
      .trim();                           // Remove leading/trailing whitespace
    
    console.log("Cleaned code first 100 chars:", cleanedSourceCode.substring(0, 100));
    
    const { abi, bytecode } = compile(cleanedSourceCode, contractName);
    
    // Store the ABI and Bytecode into a JSON file
    const artifact = JSON.stringify({ abi, bytecode }, null, 2);
    await fs.writeFile("Demo.json", artifact);
    
    return { abi, bytecode };
  } catch (error) {
    console.error("Compilation error:", error);
    throw error;
  }
}

function compile(sourceCode, contractName) {
  try {
    // Additional cleaning to handle Monaco Editor artifacts
    let cleanedCode = sourceCode
      .replace(/^(solidity|javascript)\s*/i, '') // Remove language identifiers (case insensitive)
      .replace(/^\s*[\r\n]+/, '')               // Remove leading newlines
      .trim();
    
    console.log("Final cleaned code preview:", cleanedCode.substring(0, 150));
    
    // Validate that we have valid Solidity code
    if (!cleanedCode) {
      throw new Error('No source code provided after cleaning');
    }
    
    // Check if code starts with valid Solidity syntax (pragma, comment, or SPDX)
    const validStarts = [
      /^\s*\/\/\s*SPDX-License-Identifier/i,  // SPDX license identifier
      /^\s*\/\//,                              // Single line comment
      /^\s*\/\*/,                              // Multi-line comment
      /^\s*pragma\s+solidity/i                // Pragma statement
    ];
    
    const hasValidStart = validStarts.some(pattern => pattern.test(cleanedCode));
    
    if (!hasValidStart) {
      console.error("Invalid code start. Code begins with:", cleanedCode.substring(0, 50));
      throw new Error('Source code must start with SPDX license, comment, or pragma statement');
    }
    
    // Create the Solidity Compiler Standard Input JSON
    const input = {
      language: "Solidity",
      sources: {
        [`${contractName}.sol`]: {
          content: cleanedCode
        }
      },
      settings: {
        outputSelection: {
          "*": {
            "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"]
          }
        },
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "london" // Use a stable EVM version
      }
    };
    
    console.log("Sending to solc compiler...");
    
    // Compile with solc
    const output = solc.compile(JSON.stringify(input));
    
    if (!output) {
      throw new Error('Solidity compiler returned no output');
    }
    
    const compilationResult = JSON.parse(output);
    
    // Check for compilation errors first
    if (compilationResult.errors) {
      const errors = compilationResult.errors.filter(error => error.severity === 'error');
      if (errors.length > 0) {
        console.error("Compilation errors:", errors);
        const errorMessages = errors.map(e => e.formattedMessage || e.message).join('\n');
        throw new Error(`Compilation errors:\n${errorMessages}`);
      }
      
      // Log warnings but don't fail
      const warnings = compilationResult.errors.filter(error => error.severity === 'warning');
      if (warnings.length > 0) {
        console.warn("Compilation warnings:", warnings.map(w => w.message));
      }
    }
    
    // Validate compilation output structure
    if (!compilationResult.contracts) {
      throw new Error('No contracts found in compilation output');
    }
    
    // Access the compiled contract
    const fileName = `${contractName}.sol`;
    
    if (!compilationResult.contracts[fileName]) {
      const availableFiles = Object.keys(compilationResult.contracts);
      console.error("Available files:", availableFiles);
      throw new Error(`File ${fileName} not found in compilation output. Available files: ${availableFiles.join(', ')}`);
    }
    
    const contractData = compilationResult.contracts[fileName][contractName];
    
    if (!contractData) {
      const availableContracts = Object.keys(compilationResult.contracts[fileName] || {});
      console.error("Available contracts:", availableContracts);
      throw new Error(`Contract ${contractName} not found. Available contracts: ${availableContracts.join(', ')}`);
    }
    
    // Validate that we have the required data
    if (!contractData.abi) {
      throw new Error('Contract ABI not found in compilation output');
    }
    
    if (!contractData.evm || !contractData.evm.bytecode || !contractData.evm.bytecode.object) {
      throw new Error('Contract bytecode not found in compilation output');
    }
    
    console.log("Compilation successful!");
    console.log("ABI length:", contractData.abi.length);
    console.log("Bytecode length:", contractData.evm.bytecode.object.length);
    
    return {
      abi: contractData.abi,
      bytecode: contractData.evm.bytecode.object,
    };
    
  } catch (error) {
    console.error("Solc compilation error:", error);
    throw error;
  }
}

export default compilefile;
