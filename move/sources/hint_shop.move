/// Hint shop: charges a player shelbyUSD (FA) to reveal one cell.
///
/// Flat pricing sized to fit shelbyUSD faucet limits. shelbyUSD has **8**
/// decimals on testnet (verified against the FA metadata object), so
/// 1 sUSD = 1e8 raw:
///   hint cost = 0.0005 sUSD = 50_000 raw
///   season-pass hint = 0.00025 sUSD = 25_000 raw (via season_pass::buy_hint)
///
/// Fee split (of charged amount):
///   50% treasury (Shop.treasury)
///   30% curator (@sudoku)
///   20% burn sink (fixed address — not a protocol burn)
///
/// A player may buy at most `MAX_HINTS_PER_LEVEL` hints on any single level;
/// the counter is keyed by (player, level) and never resets.
module sudoku::hint_shop {
    use aptos_framework::event;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use aptos_std::table::{Self, Table};
    use std::signer;

    friend sudoku::season_pass;

    // FA metadata object address for shelbyUSD on testnet.
    const HARDCODED_SHELBY_USD_METADATA: address = @0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1;

    /// Sink for the 20% "burn" share. Not a protocol-level FA burn — funds
    /// are transferred here and are effectively irrecoverable.
    const BURN_SINK: address = @0x000000000000000000000000000000000000000000000000000000000000dead;

    /// Flat hint price in raw sUSD (8 decimals) = 0.0005 sUSD.
    const HINT_COST_RAW: u64 = 50_000;
    /// Season-pass discounted price = half = 0.00025 sUSD.
    const HINT_COST_PASS_RAW: u64 = 25_000;

    /// Hints a single player may buy on one level.
    const MAX_HINTS_PER_LEVEL: u64 = 5;

    /// Player already bought `MAX_HINTS_PER_LEVEL` hints on this level.
    const EHINT_LIMIT_REACHED: u64 = 100;

    struct Shop has key {
        treasury: address,
    }

    struct HintUsage has key {
        counts: Table<address, Table<u64, u64>>,
    }

    #[event]
    struct HintPurchased has drop, store {
        buyer: address,
        level: u64,
        amount: u64,
        count_after: u64,
    }

    public entry fun init(admin: &signer, treasury: address) {
        move_to(admin, Shop { treasury });
        move_to(admin, HintUsage { counts: table::new<address, Table<u64, u64>>() });
    }

    /// Flat hint price, raw sUSD (8 decimals).
    public fun price_for(_level: u64): u64 {
        HINT_COST_RAW
    }

    public fun pass_price_raw(): u64 {
        HINT_COST_PASS_RAW
    }

    /// Address that receives the treasury share (and season-pass payments).
    public fun treasury_address(): address acquires Shop {
        borrow_global<Shop>(@sudoku).treasury
    }

    /// Resolve the shelbyUSD FA metadata object address.
    public fun shelby_usd_metadata(): Object<Metadata> {
        object::address_to_object<Metadata>(HARDCODED_SHELBY_USD_METADATA)
    }

    fun read_count(usage: &HintUsage, player: address, level: u64): u64 {
        if (!table::contains(&usage.counts, player)) return 0;
        let inner = table::borrow(&usage.counts, player);
        if (!table::contains(inner, level)) return 0;
        *table::borrow(inner, level)
    }

    fun bump_count(usage: &mut HintUsage, player: address, level: u64): u64 {
        if (!table::contains(&usage.counts, player)) {
            table::add(&mut usage.counts, player, table::new<u64, u64>());
        };
        let inner = table::borrow_mut(&mut usage.counts, player);
        if (table::contains(inner, level)) {
            let slot = table::borrow_mut(inner, level);
            *slot = *slot + 1;
            *slot
        } else {
            table::add(inner, level, 1);
            1
        }
    }

    #[view]
    public fun hints_used(player: address, level: u64): u64 acquires HintUsage {
        let usage = borrow_global<HintUsage>(@sudoku);
        read_count(usage, player, level)
    }

    #[view]
    public fun max_hints_per_level(): u64 {
        MAX_HINTS_PER_LEVEL
    }

    /// Charge `amount` with a 50/30/20 split and bump the per-level counter.
    /// Only callable by this module and `season_pass` (discounted path).
    public(friend) fun buy_hint_priced(
        buyer: &signer,
        level: u64,
        amount: u64,
    ) acquires Shop, HintUsage {
        let buyer_addr = signer::address_of(buyer);
        let used = read_count(borrow_global<HintUsage>(@sudoku), buyer_addr, level);
        assert!(used < MAX_HINTS_PER_LEVEL, EHINT_LIMIT_REACHED);

        let metadata = shelby_usd_metadata();
        let treasury = borrow_global<Shop>(@sudoku).treasury;
        let treasury_amt = amount / 2;
        let curator_amt = amount * 3 / 10;
        let burn_amt = amount - treasury_amt - curator_amt;
        primary_fungible_store::transfer(buyer, metadata, treasury, treasury_amt);
        primary_fungible_store::transfer(buyer, metadata, @sudoku, curator_amt);
        primary_fungible_store::transfer(buyer, metadata, BURN_SINK, burn_amt);

        let usage = borrow_global_mut<HintUsage>(@sudoku);
        let count_after = bump_count(usage, buyer_addr, level);
        event::emit(HintPurchased {
            buyer: buyer_addr,
            level,
            amount,
            count_after,
        });
    }

    public entry fun buy_hint(buyer: &signer, level: u64) acquires Shop, HintUsage {
        buy_hint_priced(buyer, level, HINT_COST_RAW);
    }
}
