const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram } = require('@solana/web3.js');

// Set up the provider and program
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.Restake;
const provider = anchor.getProvider();
const connection = provider.connection;

async function initializeStakeAccount() {
  // Derive the PDA for the stake account
  const [stakeAccountPDA, _] = await PublicKey.findProgramAddress(
    [Buffer.from("stake15"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  // Derive the PDA for the program (used as withdraw authority)
  const [programPDA, _programBump] = await PublicKey.findProgramAddress(
    [Buffer.from("withdraw"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  console.log("ProgramPDA as withdrawer auth: ", programPDA.toString());
  console.log("stakeAccountPDA : ", stakeAccountPDA.toString());

  try {
    // Call the initialize_stake_account function in the Solana program
    const tx = await program.methods
      .initializeStakeAccount()
      .accounts({
        initializer: provider.wallet.publicKey,
        stakeAccount: stakeAccountPDA,
        programPda: programPDA,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        stakeProgram: anchor.web3.StakeProgram.programId,
      })
      .signers([provider.wallet.payer]) // Only the initializer signs
      .rpc();

    console.log("Initialization transaction signature", tx);

    // Check the balance of the stake account to verify initialization
    const balance = await connection.getBalance(stakeAccountPDA);
    console.log(`Stake account balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);

  } catch (err) {
    console.error("Initialization failed with error:", err);
    if (err.logs) {
      console.log("Transaction logs:", err.logs);
    }
  }
}

initializeStakeAccount();

