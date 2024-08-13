use anchor_lang::prelude::*;
use std::str::FromStr;
use solana_program::{
    program::invoke_signed,
    pubkey::Pubkey,
    stake::instruction as stake_instruction,
    stake::state::{Authorized, Lockup, StakeStateV2},
    stake::program::ID as STAKE_PROGRAM_ID,
    system_instruction,
};

declare_id!("FGmyMg3A1eTBNaVu8iy8vHFiEsB8PG5QijzcKxQ2nfgX");

// Hardcoded public key for the Stake Config Sysvar
const STAKE_CONFIG_PUBKEY: &str = "StakeConfig11111111111111111111111111111111";

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

        let initializer_key = initializer.key();
        let (stake_account_key, bump_seed) = Pubkey::find_program_address(
            &[b"stake17", initializer_key.as_ref()],
            ctx.program_id,
        );
        let seeds = &[b"stake17", initializer_key.as_ref(), &[bump_seed]];

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

        let authorized = Authorized {
            staker: program_pda.key(),
            withdrawer: program_pda.key(),
        };
        let lockup = Lockup::default();

        let initialize_stake_instruction = stake_instruction::initialize(
            &stake_account_key,
            &authorized,
            &lockup,
        );

        invoke_signed(
            &initialize_stake_instruction,
            &[
                stake_account.to_account_info(),
                ctx.accounts.rent.to_account_info(),
                ctx.accounts.stake_program.to_account_info(),
            ],
            &[seeds],
        )?;

        Ok(())
    }

    pub fn withdraw_from_stake_account(
        ctx: Context<WithdrawFromStakeAccount>,
        lamports: u64,
    ) -> Result<()> {
        let initializer = &ctx.accounts.initializer;
        let stake_account = &ctx.accounts.stake_account;
        let program_pda = &ctx.accounts.program_pda;

        let (stake_account_key, _bump_seed) = Pubkey::find_program_address(
            &[b"stake17", initializer.key().as_ref()],
            ctx.program_id,
        );

        let (withdraw_pda_key, bump_seed) = Pubkey::find_program_address(
            &[b"withdraw", initializer.key().as_ref()],
            ctx.program_id,
        );
        let binding = initializer.key();
        let seeds = &[b"withdraw", binding.as_ref(), &[bump_seed]];

        require_keys_eq!(program_pda.key(), withdraw_pda_key, ErrorCode::InvalidProgramPDA);

        let withdraw_instruction = stake_instruction::withdraw(
            &stake_account_key,
            &program_pda.key(),
            &initializer.key(),
            lamports,
            None,
        );

        invoke_signed(
            &withdraw_instruction,
            &[
                stake_account.to_account_info(),
                initializer.to_account_info(),
                program_pda.to_account_info(),
                ctx.accounts.stake_program.to_account_info(),
                ctx.accounts.clock.to_account_info(),
                ctx.accounts.stake_history.to_account_info(),
            ],
            &[seeds],
        )?;

        Ok(())
    }

    pub fn delegate(ctx: Context<Delegate>, voter_pubkey: Pubkey) -> Result<()> {
        let initializer = &ctx.accounts.initializer;
        let stake_account = &ctx.accounts.stake_account;
        let program_pda = &ctx.accounts.program_pda;

        let (derived_program_pda, bump_seed) = Pubkey::find_program_address(
            &[b"withdraw", initializer.key().as_ref()],
            ctx.program_id,
        );
        let (stake_program_pda, stake_bump_seed) = Pubkey::find_program_address(
            &[b"stake17", initializer.key().as_ref()],
            ctx.program_id,
        );
        require_keys_eq!(program_pda.key(), derived_program_pda, ErrorCode::InvalidProgramPDA);
        require_keys_eq!(stake_account.key(), stake_program_pda, ErrorCode::InvalidProgramPDA);

        let binding = initializer.key();
        let seeds = &[b"withdraw", binding.as_ref(), &[bump_seed]];
        let stake_program_pda_seeds = &[b"stake17", binding.as_ref(), &[stake_bump_seed]];

        let delegate_instruction = stake_instruction::delegate_stake(
            &stake_account.key(),
            &program_pda.key(),
            &voter_pubkey,
        );

        invoke_signed(
            &delegate_instruction,
            &[
                stake_account.to_account_info(),
                program_pda.to_account_info(),
                ctx.accounts.voter.to_account_info(),
                ctx.accounts.stake_program.to_account_info(),
                ctx.accounts.clock.to_account_info(),
                ctx.accounts.stake_history.to_account_info(),
                ctx.accounts.stake_config.to_account_info(),  // Include the stake config account
            ],
            &[seeds],
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
    pub stake_account: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: Stake program needs to be included for CPI
    #[account(address = STAKE_PROGRAM_ID)]
    pub stake_program: AccountInfo<'info>,

    /// CHECK: The PDA for the program, this is safe because it is derived and controlled by the program.
    pub program_pda: AccountInfo<'info>,
    pub clock: Sysvar<'info, Clock>,
    pub stake_history: Sysvar<'info, StakeHistory>,
}

#[derive(Accounts)]
pub struct WithdrawFromStakeAccount<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    /// CHECK: This account is manually verified in the program
    #[account(mut)]
    pub stake_account: AccountInfo<'info>,

    /// CHECK: This PDA account is safe because it is derived and controlled by the program.
    #[account(mut, seeds = [b"withdraw", initializer.key().as_ref()], bump)]
    pub program_pda: AccountInfo<'info>,

    pub clock: Sysvar<'info, Clock>,
    pub stake_history: Sysvar<'info, StakeHistory>,

    /// CHECK: Stake program needs to be included for CPI
    #[account(address = STAKE_PROGRAM_ID)]
    pub stake_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Delegate<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,

    /// CHECK: This account is manually verified in the program
    #[account(mut, seeds = [b"stake17", initializer.key().as_ref()], bump)]
    pub stake_account: AccountInfo<'info>,

    /// CHECK: This PDA account is safe because it is derived and controlled by the program.
    #[account(mut, seeds = [b"withdraw", initializer.key().as_ref()], bump)]
    //#[account(mut)]
    pub program_pda: AccountInfo<'info>,

    pub clock: Sysvar<'info, Clock>,

    /// CHECK: Stake program needs to be included for CPI
    #[account(address = STAKE_PROGRAM_ID)]
    pub stake_program: AccountInfo<'info>,

    /// CHECK: Voter account to which stake is being delegated
    pub voter: AccountInfo<'info>,
    pub stake_history: Sysvar<'info, StakeHistory>,
    
    /// CHECK: The stake config sysvar
    #[account(address = Pubkey::from_str(STAKE_CONFIG_PUBKEY).unwrap())]
    pub stake_config: AccountInfo<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Stake account already exists.")]
    StakeAccountAlreadyExists,
    #[msg("Invalid Program PDA.")]
    InvalidProgramPDA,
}

