const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');

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

  console.log("Lock Account PDA:", lockAccountPDA.toString());

  try {
    // Fetch the account data
    const lockAccount = await program.account.lockAccount.fetch(lockAccountPDA);

    // Display the account information
    console.log("Initializer:", lockAccount.initializer.toString());
    console.log("Delegated Lamports:", lockAccount.delegatedLamports.toString());
    console.log("Vote Account:", lockAccount.voteAccount.toString());
    console.log("Block ID:", lockAccount.blockId.toString());
    console.log("Lock:", lockAccount.lock);
  } catch (err) {
    console.error("Failed to fetch lock account data:", err);
  }
}

// Handle CLI arguments
const initializerPubkey = process.argv[2];

if (!initializerPubkey) {
  console.error("Please provide the initializer public key.");
  process.exit(1);
}

fetchLockingPDAState(new PublicKey(initializerPubkey));

