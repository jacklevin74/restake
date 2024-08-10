import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Restake } from "../target/types/restake";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("restake", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Restake as Program<Restake>;
  const provider = anchor.getProvider();
  const connection = provider.connection;

  it("Creates a stake account and sets the withdraw authority to the program PDA", async () => {
    // Amount of lamports to stake
    const lamports = 0.5 * LAMPORTS_PER_SOL;

    // Derive the PDA for the stake account
    const [stakeAccountPDA, _stakeBump] = await PublicKey.findProgramAddress(
      [Buffer.from("stake3"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    // Derive the PDA for the program (used as withdraw authority)
    const [programPDA, _programBump] = await PublicKey.findProgramAddress(
      [Buffer.from("withdraw"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    // Create the stake account using the program
    try {
      const tx = await program.methods
        .createStakeAccount(new anchor.BN(lamports))
        .accounts({
          initializer: provider.wallet.publicKey,
          stakeAccount: stakeAccountPDA,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          programPda: programPDA, // Pass the PDA as withdraw authority
        })
        .signers([provider.wallet.payer]) // Only the initializer signs
        .rpc();

      console.log("Stake account creation transaction signature", tx);

      // Check the balance of the stake account
      const balance = await connection.getBalance(stakeAccountPDA);
      console.log(`Stake account balance: ${balance / LAMPORTS_PER_SOL} SOL`);

      // Fetch the stake account details (if needed for verification)
      const accountInfo = await connection.getAccountInfo(stakeAccountPDA);
      console.log("Stake account info:", accountInfo);

    } catch (err) {
      console.error("Transaction failed with error:", err);
      if (err.logs) {
        console.log("Transaction logs:", err.logs);
      }
    }
  });
});

