/// Rewards module: pays out shelbyUSD (FA) from a treasury on level clear.
///
/// Flat reward for clearing any level, sized to fit shelbyUSD faucet limits.
/// shelbyUSD has **8** decimals on testnet, so 1 sUSD = 1e8 raw:
///   reward = 0.01 sUSD = 1_000_000 raw
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

    // FA metadata object address for shelbyUSD on testnet (mirror of the
    // constant in hint_shop.move). Resolve via:
    //   aptos move view --function-id 0x249f5c642a63885ff88a5113b3ba0079840af5a1357706f8c7f3bfc5dd12511f::shelby_usd::metadata --network testnet
    const HARDCODED_SHELBY_USD_METADATA: address = @0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1;

    /// Flat reward in raw sUSD (8 decimals) = 0.01 sUSD.
    const REWARD_RAW: u64 = 1_000_000;

    struct Rewards has key {
        treasury_signer_cap: account::SignerCapability,
        claimed: Table<address, Table<u64, bool>>,
    }

    #[event]
    struct RewardClaimed has drop, store { player: address, level: u64, amount: u64 }

    /// One-time initialization. Computes the resource account address from
    /// `admin + seed` and stores a `SignerCap` for it. The deployer funds
    /// the resource account via `top_up_treasury`.
    public entry fun init(admin: &signer) {
        let seed = b"shelby-sudoku-rewards";
        let (_treasury_signer, cap) = account::create_resource_account(admin, seed);
        let claimed = table::new<address, Table<u64, bool>>();
        move_to(admin, Rewards { treasury_signer_cap: cap, claimed });
    }

    /// Flat per-level reward, raw sUSD (8 decimals).
    public fun reward_for(_level: u64): u64 {
        REWARD_RAW
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

    /// Deployer seeds the rewards pool by transferring shelbyUSD FA from
    /// their primary store to the resource account's primary store.
    public entry fun top_up_treasury(admin: &signer, amount: u64) acquires Rewards {
        let r = borrow_global<Rewards>(@sudoku);
        let treasury_addr = account::get_signer_capability_address(&r.treasury_signer_cap);
        let metadata = shelby_usd_metadata();
        primary_fungible_store::transfer(admin, metadata, treasury_addr, amount);
    }

    public entry fun claim(player: &signer, level: u64) acquires Rewards {
        let r = borrow_global_mut<Rewards>(@sudoku);
        let player_addr = signer::address_of(player);
        if (player_claimed(r, player_addr, level)) {
            abort 1001
        };
        let amount = reward_for(level);
        let metadata = shelby_usd_metadata();
        let treasury_signer = account::create_signer_with_capability(&r.treasury_signer_cap);
        primary_fungible_store::transfer(&treasury_signer, metadata, player_addr, amount);
        mark_claimed(r, player_addr, level);
        event::emit(RewardClaimed { player: player_addr, level, amount });
    }
}
