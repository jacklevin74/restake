const express = require('express');
const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');

const app = express();
const port = 3335;

// Set up the provider and program
anchor.setProvider(anchor.AnchorProvider.env());
const program = anchor.workspace.Restake;
const provider = anchor.getProvider();

async function fetchLockingPDAState(initializerPubkey) {
  // Derive the PDA for the lock account
  const [lockAccountPDA, _] = await PublicKey.findProgramAddress(
    [Buffer.from("lock"), initializerPubkey.toBuffer()],
    program.programId
  );

  try {
    // Fetch the account data
    const lockAccount = await program.account.lockAccount.fetch(lockAccountPDA);
    
    // Return the account information as an object
    return {
      lockAccountPDA: lockAccountPDA.toString(),
      initializer: lockAccount.initializer.toString(),
      delegatedLamports: lockAccount.delegatedLamports.toString(),
      voteAccount: lockAccount.voteAccount.toString(),
      blockId: lockAccount.blockId.toString(),
      lock: lockAccount.lock
    };
  } catch (err) {
    console.error("Failed to fetch lock account data:", err);
    throw err;
  }
}

app.get('/fetch-lock-state', async (req, res) => {
  const initializerPubkey = req.query.initializer;
  
  if (!initializerPubkey) {
    return res.status(400).json({ error: "Please provide the initializer public key as a query parameter." });
  }

  try {
    const lockState = await fetchLockingPDAState(new PublicKey(initializerPubkey));
    res.json(lockState);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch lock account data", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
