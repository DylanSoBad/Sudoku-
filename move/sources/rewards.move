/// Rewards module: pays out shelbyUSD (FA) from a treasury on level clear.
///
/// Flat reward for clearing any level, sized to fit shelbyUSD faucet limits.
/// shelbyUSD has **8** decimals on testnet, so 1 sUSD = 1e8 raw:
///   reward = 0.01 sUSD = 1_000_000 raw
///   daily (level 0) = 0.02 sUSD = 2_000_000 raw
///
/// Level `0` is the daily-challenge claim key so it never collides with
/// campaign levels 1–20.
///
/// The module creates a `SignerCap` at `init` time so it can move funds
/// out of a resource account without prompting the deployer on every
/// claim. The deployer must call `top_up_treasury` first to seed the
/// resource account's FA store.
module sudoku::rewards {
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use std::signer;
    use aptos_std::table::{Self, Table};

    friend sudoku::referral;

    const HARDCODED_SHELBY_USD_METADATA: address = @0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1;

    /// Flat reward in raw sUSD (8 decimals) = 0.01 sUSD.
    const REWARD_RAW: u64 = 1_000_000;
    /// Daily challenge (level 0) pays 2x.
    const DAILY_REWARD_RAW: u64 = 2_000_000;
    /// Per-side referral bonus = 0.01 sUSD.
    const REFERRAL_BONUS_RAW: u64 = 1_000_000;

    const E_ALREADY_CLAIMED: u64 = 1001;

    struct Rewards has key {
        treasury_signer_cap: account::SignerCapability,
        claimed: Table<address, Table<u64, bool>>,
    }

    #[event]
    struct RewardClaimed has drop, store { player: address, level: u64, amount: u64 }

    public entry fun init(admin: &signer) {
        let seed = b"shelby-sudoku-rewards";
        let (_treasury_signer, cap) = account::create_resource_account(admin, seed);
        let claimed = table::new<address, Table<u64, bool>>();
        move_to(admin, Rewards { treasury_signer_cap: cap, claimed });
    }

    /// Per-level reward. Level 0 (daily) is 2x; everything else is flat.
    public fun reward_for(level: u64): u64 {
        if (level == 0) {
            DAILY_REWARD_RAW
        } else {
            REWARD_RAW
        }
    }

    public fun shelby_usd_metadata(): Object<Metadata> {
        object::address_to_object<Metadata>(HARDCODED_SHELBY_USD_METADATA)
    }

    fun player_claimed(r: &Rewards, player: address, level: u64): bool {
        if (!table::contains(&r.claimed, player)) return false;
        let inner = table::borrow(&r.claimed, player);
        if (!table::contains(inner, level)) return false;
        *table::borrow(inner, level)
    }

    fun mark_claimed(r: &mut Rewards, player: address, level: u64) {
        if (!table::contains(&r.claimed, player)) {
            table::add(&mut r.claimed, player, table::new<u64, bool>());
        };
        let inner = table::borrow_mut(&mut r.claimed, player);
        if (table::contains(inner, level)) {
            *table::borrow_mut(inner, level) = true;
        } else {
            table::add(inner, level, true);
        };
    }

    public entry fun top_up_treasury(admin: &signer, amount: u64) acquires Rewards {
        let r = borrow_global<Rewards>(@sudoku);
        let treasury_addr = account::get_signer_capability_address(&r.treasury_signer_cap);
        let metadata = shelby_usd_metadata();
        primary_fungible_store::transfer(admin, metadata, treasury_addr, amount);
    }

    public entry fun claim(player: &signer, level: u64) acquires Rewards {
        let r = borrow_global_mut<Rewards>(@sudoku);
        let player_addr = signer::address_of(player);
        assert!(!player_claimed(r, player_addr, level), E_ALREADY_CLAIMED);
        let amount = reward_for(level);
        let metadata = shelby_usd_metadata();
        let treasury_signer = account::create_signer_with_capability(&r.treasury_signer_cap);
        primary_fungible_store::transfer(&treasury_signer, metadata, player_addr, amount);
        mark_claimed(r, player_addr, level);
        event::emit(RewardClaimed { player: player_addr, level, amount });
    }

    /// Pay a flat referral bonus from the rewards treasury. Only callable by
    /// `sudoku::referral` so random clients cannot drain the pool.
    public(friend) fun pay_bonus(to: address, amount: u64) acquires Rewards {
        let r = borrow_global<Rewards>(@sudoku);
        let metadata = shelby_usd_metadata();
        let treasury_signer = account::create_signer_with_capability(&r.treasury_signer_cap);
        primary_fungible_store::transfer(&treasury_signer, metadata, to, amount);
    }

    public fun referral_bonus_raw(): u64 {
        REFERRAL_BONUS_RAW
    }
}
