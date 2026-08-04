/// Hint shop: charges a player shelbyUSD (FA) to reveal one cell.
///
/// Per-level pricing, keyed by difficulty tier. shelbyUSD has **8** decimals
/// on testnet (verified against the FA metadata object), so 1 sUSD = 1e8 raw:
///   easy   = 0.1 sUSD =  10_000_000
///   medium = 0.2 sUSD =  20_000_000
///   hard   = 0.4 sUSD =  40_000_000
///   expert = 0.7 sUSD =  70_000_000
///   master = 1.0 sUSD = 100_000_000
///
/// buy_hint transfers the per-level amount from the buyer's primary FA store
/// to the treasury address stored at module init time.
module sudoku::hint_shop {
    use aptos_framework::event;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use std::signer;

    // FA metadata object address for shelbyUSD on testnet.
    // Resolved via public view call:
    //   aptos move view --function-id 0x249f5c642a63885ff88a5113b3ba0079840af5a1357706f8c7f3bfc5dd12511f::shelby_usd::metadata --network testnet
    // And confirmed via /v1/accounts/{addr}/resources showing
    // 0x1::fungible_asset::Metadata at this address.
    // If the shelby_usd module is ever re-upgraded and the metadata object
    // address moves, update both `hint_shop` and `rewards` here.
    const HARDCODED_SHELBY_USD_METADATA: address = @0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1;

    struct Shop has key {
        treasury: address,
    }

    #[event]
    struct HintPurchased has drop, store { buyer: address, level: u64, amount: u64 }

    public entry fun init(admin: &signer, treasury: address) {
        move_to(admin, Shop { treasury });
    }

    /// Per-level hint price, raw sUSD (8 decimals).
    public fun price_for(level: u64): u64 {
        if (level <= 3) 10_000_000
        else if (level <= 6) 20_000_000
        else if (level <= 10) 40_000_000
        else if (level <= 14) 70_000_000
        else 100_000_000
    }

    /// Resolve the shelbyUSD FA metadata object address. Hard-coded from the
    /// testnet view call above so the package compiles standalone.
    public fun shelby_usd_metadata(): Object<Metadata> {
        object::address_to_object<Metadata>(HARDCODED_SHELBY_USD_METADATA)
    }

    public entry fun buy_hint(buyer: &signer, level: u64) acquires Shop {
        let amount = price_for(level);
        let metadata = shelby_usd_metadata();
        let s = borrow_global<Shop>(@sudoku);
        primary_fungible_store::transfer(buyer, metadata, s.treasury, amount);
        event::emit(HintPurchased { buyer: signer::address_of(buyer), level, amount });
    }
}
