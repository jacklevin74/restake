use anchor_lang::prelude::*;
use solana_program::{
    program::invoke_signed,
    stake::state::{Authorized, Lockup, StakeStateV2},
    stake::instruction as stake_instruction,
    stake::program::ID as STAKE_PROGRAM_ID,
    system_instruction,
};

declare_id!("GRkByZX5pRMwceDhBb9P9qiio7ivn6SZcZyRMpk2ohGg");

#[program]
pub mod restake {
    use super::*;

    pub fn create_stake_account(
        ctx: Context<CreateStakeAccount>,
        lamports: u64,
    ) -> Result<()> {
        let initializer = &ctx.accounts.initializer;
        let stake_account = &ctx.accounts.stake_account;
        let program_pda = &ctx.accounts.program_pda;

        // Store the public key to ensure it's properly borrowed
        let initializer_key = initializer.key();

        // Derive the stake account's PDA
        let (stake_account_key, bump_seed) = Pubkey::find_program_address(
            &[b"stake8", initializer_key.as_ref()],
            ctx.program_id,
        );
        let seeds = &[b"stake8", initializer_key.as_ref(), &[bump_seed]];

        // Create the stake account
        let create_account_instruction = system_instruction::create_account(
            &initializer_key,
            &stake_account_key,
            lamports,
            std::mem::size_of::<StakeStateV2>() as u64,
            &STAKE_PROGRAM_ID,
        );

        invoke_signed(
            &create_account_instruction,
            &[
                initializer.to_account_info(),
                stake_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[seeds],
        )?;

        msg!("Stake account created");

        // Configure the authorized and lockup parameters
        let authorized = Authorized {
            staker: initializer_key, // initializer is the staker
            withdrawer: program_pda.key(), // program's PDA as the withdraw authority
        };
        let lockup = Lockup::default();

        // Initialize the stake account with the program's PDA as the withdraw authority
        let initialize_stake_instruction = stake_instruction::initialize(
            &stake_account_key,
            &authorized,
            &lockup,
        );
        
        msg!("Stake account initialized");

        /*
        invoke_signed(
            &initialize_stake_instruction,
            &[
                stake_account.to_account_info(),
                ctx.accounts.rent.to_account_info(),
                ctx.accounts.stake_program.to_account_info(),
            ],
            &[seeds],
        )?;
        */

        let withdraw_instruction = stake_instruction::withdraw(
    &stake_account_key,
    &program_pda.key(), // This is the withdraw authority, which is the PDA
    &initializer.key(), // Send lamports back to the initializer
    lamports,
    None, // No custodian required
);

invoke_signed(
    &withdraw_instruction,
    &[
        stake_account.to_account_info(),
        initializer.to_account_info(), // Unstaked lamports go back to the initializer
        ctx.accounts.stake_program.to_account_info(),
        ctx.accounts.clock.to_account_info(),
        ctx.accounts.stake_history.to_account_info(),
    ],
    &[&[
        b"stake8",
        initializer.key().as_ref(),
        &[bump_seed],
    ]],
)?;


        Ok(())
    }
}


#[derive(Accounts)]
pub struct CreateStakeAccount<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    /// CHECK: This account is manually verified in the program
    #[account(mut)]
    pub stake_account: AccountInfo<'info>, // Should be writable

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: Stake program needs to be included for CPI
    #[account(address = STAKE_PROGRAM_ID)]
    pub stake_program: AccountInfo<'info>,

    /// CHECK: The PDA for the program
    #[account(mut, seeds = [b"stake8", initializer.key().as_ref()], bump)]
    pub program_pda: AccountInfo<'info>, // No need for signer here; just correct derivation

    pub clock: Sysvar<'info, Clock>, // Required for the withdraw instruction

    pub stake_history: Sysvar<'info, StakeHistory>, // Required for the withdraw instruction
}


#[error_code]
pub enum ErrorCode {
    #[msg("Stake account already exists.")]
    StakeAccountAlreadyExists,
}

