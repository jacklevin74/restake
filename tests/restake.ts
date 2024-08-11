import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Restake } from "../target/types/restake";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";

describe("restake", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Restake as Program<Restake>;
  const provider = anchor.getProvider();
  const connection = provider.connection;

  it("Creates and unstakes a stake account", async () => {
    // Amount of lamports to stake
    const lamports = 0.5 * LAMPORTS_PER_SOL;

    // Generate a keypair for the stake account
    const stakeAccount = Keypair.generate();

    // Derive the PDA for the stake account
    const [stakeAccountPDA, _] = await PublicKey.findProgramAddress(
      [Buffer.from("stake5"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    // Derive the PDA for the program (used as withdraw authority)
    const [programPDA, _programBump] = await PublicKey.findProgramAddress(
      [Buffer.from("withdraw"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    console.log("ProgramPDA as withdrawer auth: ", programPDA);

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
          programPda: programPDA,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([provider.wallet.payer]) // Only the initializer signs
        .rpc();

      console.log("Transaction signature", tx);

      // Check the balance of the stake account
      const balance = await connection.getBalance(stakeAccountPDA);
      console.log(`Stake account balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    } catch (err) {
      console.error("Transaction failed with error:", err);
      if (err.logs) {
        console.log("Transaction logs:", err.logs);
      }
    }
  });
});

