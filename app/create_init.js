const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram } = require('@solana/web3.js');

// Set up the provider and program
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.Restake;
const provider = anchor.getProvider();
const connection = provider.connection;

async function createAndInitializeStakeAccount(lamports) {
  // Derive PDAs
  const [stakeAccountPDA, _] = await PublicKey.findProgramAddress(
    [Buffer.from("stake16"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  const [programPDA, _programBump] = await PublicKey.findProgramAddress(
    [Buffer.from("withdraw"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  console.log("ProgramPDA as withdrawer auth:", programPDA.toString());
  console.log("stakeAccountPDA:", stakeAccountPDA.toString());

  try {
    // Check and potentially create the stake account
    const accountInfo = await connection.getAccountInfo(stakeAccountPDA);

    if (accountInfo === null) {
      console.log("Stake account does not exist, creating...");

      const createTx = await program.methods
        .createStakeAccount(new anchor.BN(lamports))
        .accounts({
          initializer: provider.wallet.publicKey,
          stakeAccount: stakeAccountPDA,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          stakeProgram: anchor.web3.StakeProgram.programId,
          programPda: programPDA,
        })
        .signers([provider.wallet.payer])
        .rpc();

      console.log("Create stake account transaction signature:", createTx);
    } else {
      console.log("Stake account already exists.");
    }

  } catch (err) {
    console.error("Initialization failed with error:", err);
    if (err.logs) {
      console.log("Transaction logs:", err.logs);
    }
  }
}

async function withdrawFromStakeAccount(lamports) {
  // Derive PDAs
  const [stakeAccountPDA, _] = await PublicKey.findProgramAddress(
    [Buffer.from("stake16"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  const [programPDA, _programBump] = await PublicKey.findProgramAddress(
    [Buffer.from("withdraw"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  console.log("ProgramPDA as withdrawer auth:", programPDA.toString());
  console.log("stakeAccountPDA:", stakeAccountPDA.toString());

  try {
    // Withdraw lamports back to the initializer
    const withdrawTx = await program.methods
      .withdrawFromStakeAccount(new anchor.BN(lamports))
      .accounts({
        initializer: provider.wallet.publicKey,
        stakeAccount: stakeAccountPDA,
        programPda: programPDA,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        stakeHistory: anchor.web3.SYSVAR_STAKE_HISTORY_PUBKEY,
        stakeProgram: anchor.web3.StakeProgram.programId,
      })
      .signers([provider.wallet.payer])
      .rpc();

    console.log("Withdrawal transaction signature:", withdrawTx);

    const balance = await connection.getBalance(stakeAccountPDA);
    console.log(`Stake account balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
  } catch (err) {
    console.error("Withdrawal failed with error:", err);
    if (err.logs) {
      console.log("Transaction logs:", err.logs);
    }
  }
}

// Handle CLI arguments
const action = process.argv[2];
const lamports = parseFloat(process.argv[3]) * anchor.web3.LAMPORTS_PER_SOL;

if (action === 'init') {
  createAndInitializeStakeAccount(lamports);
} else if (action === 'withdraw') {
  withdrawFromStakeAccount(lamports);
} else {
  console.log("Invalid action. Use 'init' to create/initialize or 'withdraw' to withdraw lamports.");
}

