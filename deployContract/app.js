import express from "express";
import cors from "cors";
import compilefile from "./compile.js";
import deployfile from "./deploy.js";

const app = express();

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Increase payload limit

// Function to extract contract name from Solidity code
function extractContractName(code) {
  const contractNameMatch = code.match(/contract\s+(\w+)\s*\{/);
  if (contractNameMatch && contractNameMatch.length > 1) {
    return contractNameMatch[1];
  }
  return null;
}

app.post("/", async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: "Valid Solidity code string is required" });
    }

    console.log("Received code length:", code.length);
    console.log("Code preview:", code.substring(0, 200));

    // Extract contract name from the Solidity code
    const contractName = extractContractName(code);
    if (!contractName) {
      return res.status(400).json({ message: "Failed to extract contract name from code" });
    }

    console.log("Processing contract:", contractName);

    // Compile the contract
    const compilationResult = await compilefile(code, contractName);
    
    // Deploy the contract
    const deployedContract = await deployfile();
    
    console.log("Contract deployed at:", deployedContract);
    
    res.status(200).json({ 
      message: "Contract deployed successfully!", 
      deployedContract: deployedContract,
      contractName: contractName,
      abi: compilationResult.abi
    });
    
  } catch (error) {
    console.error("Deployment error:", error);
    res.status(500).json({ 
      message: "Failed to deploy the contract",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(5000, () => {
  console.log("Server started on port 5000");
});
