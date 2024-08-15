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
    [Buffer.from("stake17"), provider.wallet.publicKey.toBuffer()],
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
        .signers([])  // No signers needed because the PDA signs via invoke_signed
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
    [Buffer.from("stake17"), provider.wallet.publicKey.toBuffer()],
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
        stakeProgram: anchor.web3.StakeProgram.programId,
        stakeHistory: anchor.web3.SYSVAR_STAKE_HISTORY_PUBKEY,
      })
      .signers([])  // No signers needed because the PDA signs via invoke_signed
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

async function delegateToVoter(voterPubkey, lock) {
  // Derive PDAs
  const [stakeAccountPDA, _] = await PublicKey.findProgramAddress(
    [Buffer.from("stake17"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  const [programPDA, programBump] = await PublicKey.findProgramAddress(
    [Buffer.from("withdraw"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  console.log("ProgramPDA as withdrawer auth:", programPDA.toString());
  console.log("stakeAccountPDA:", stakeAccountPDA.toString());
  console.log("Voter PublicKey:", voterPubkey.toString());
  console.log("Lock is set to:", lock);

  try {
    // Delegate stake to voterPubkey with lock parameter
    const delegateTx = await program.methods
      .delegate(voterPubkey, lock)
      .accounts({
        initializer: provider.wallet.publicKey,
        stakeAccount: stakeAccountPDA,
        programPda: programPDA,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        stakeProgram: anchor.web3.StakeProgram.programId,
        stakeHistory: anchor.web3.SYSVAR_STAKE_HISTORY_PUBKEY,
        stakeConfig: anchor.web3.SYSVAR_STAKE_CONFIG_PUBKEY,  // Include the stake config account
        voter: voterPubkey, // Include the voter account
      })
      .signers([])  // No external signers, PDA signs internally
      .rpc({
        // Add the signers for the transaction, specifying the PDA with its derived seeds
        skipPreflight: false,
      });

    console.log("Delegate transaction signature:", delegateTx);

  } catch (err) {
    console.error("Delegation failed with error:", err);
    if (err.logs) {
      console.log("Transaction logs:", err.logs);
    }
  }
}

async function undelegateFromVoter() {
  // Derive PDAs
  const [stakeAccountPDA, _] = await PublicKey.findProgramAddress(
    [Buffer.from("stake17"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  const [programPDA, programBump] = await PublicKey.findProgramAddress(
    [Buffer.from("withdraw"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  console.log("ProgramPDA as withdrawer auth:", programPDA.toString());
  console.log("stakeAccountPDA:", stakeAccountPDA.toString());

  try {
    // Undelegate stake from the current vote account
    const undelegateTx = await program.methods
      .undelegate()
      .accounts({
        initializer: provider.wallet.publicKey,
        stakeAccount: stakeAccountPDA,
        programPda: programPDA,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        stakeProgram: anchor.web3.StakeProgram.programId,
        stakeHistory: anchor.web3.SYSVAR_STAKE_HISTORY_PUBKEY,
      })
      .signers([])  // No external signers, PDA signs internally
      .rpc({
        skipPreflight: false,
      });

    console.log("Undelegate transaction signature:", undelegateTx);

  } catch (err) {
    console.error("Undelegation failed with error:", err);
    if (err.logs) {
      console.log("Transaction logs:", err.logs);
    }
  }
}

// Handle CLI arguments
const action = process.argv[2];

let voterPubkey;
let lock = false;

if (action === 'delegate') {
  if (process.argv[3]) {
    try {
      voterPubkey = new PublicKey(process.argv[3]);
    } catch (err) {
      console.error("Invalid voter public key provided:", process.argv[3]);
      process.exit(1);
    }
    if (process.argv[4]) {
      lock = process.argv[4].toLowerCase() === 'true';
    }
  } else {
    console.error("Please provide a voter public key for delegation.");
    process.exit(1);
  }
}

if (action === 'init') {
  const lamports = parseFloat(process.argv[3]) * anchor.web3.LAMPORTS_PER_SOL;
  createAndInitializeStakeAccount(lamports);
} else if (action === 'withdraw') {
  const lamports = parseFloat(process.argv[3]) * anchor.web3.LAMPORTS_PER_SOL;
  withdrawFromStakeAccount(lamports);
} else if (action === 'delegate') {
  delegateToVoter(voterPubkey, lock);
} else if (action === 'undelegate') {
  undelegateFromVoter();
} else {
  console.log("Invalid action. Use 'init' to create/initialize, 'withdraw' to withdraw lamports, 'delegate' to delegate to a voter account, or 'undelegate' to undelegate from a voter account.");
}

