const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram } = require("@solana/web3.js");

async function createStakeAccount() {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Restake;
  const provider = anchor.getProvider();
  const connection = provider.connection;

  // Amount of lamports to stake
  const lamports = 0.5 * anchor.web3.LAMPORTS_PER_SOL;

  // Derive the PDA for the stake account
  const [stakeAccountPDA, bumpSeed] = await PublicKey.findProgramAddress(
    [Buffer.from("stake15"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  console.log("StakeAccount PDA:", stakeAccountPDA.toString());

  // Check if the stake account already exists
  const accountInfo = await connection.getAccountInfo(stakeAccountPDA);
  if (accountInfo !== null) {
    console.log("Stake account already exists. Skipping creation.");
    return;
  }

  // Create the stake account and stake lamports
  try {
    const tx = await program.methods
      .createStakeAccount(new anchor.BN(lamports))
      .accounts({
        initializer: provider.wallet.publicKey,
        stakeAccount: stakeAccountPDA,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        stakeProgram: anchor.web3.StakeProgram.programId,
      })
      .signers([provider.wallet.payer]) // Only the initializer signs
      .rpc();

    console.log("Stake account creation transaction signature:", tx);

    // Check the balance of the stake account
    const balance = await connection.getBalance(stakeAccountPDA);
    console.log(`Stake account balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);

  } catch (err) {
    console.error("Transaction failed with error:", err);
    if (err.logs) {
      console.log("Transaction logs:", err.logs);
    }
  }
}

// Run the function
createStakeAccount().catch(console.error);

