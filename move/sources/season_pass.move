/// Season Pass: paid unlock for discounted hints + cosmetics.
///
/// Charge is a flat 0.1 sUSD (10_000_000 raw @ 8 decimals), paid to the
/// hint_shop treasury. The `price_micro` argument is accepted for ABI
/// compatibility with existing clients but is ignored — the on-chain
/// constant is the source of truth.
///
/// Active pass holders buy hints via `season_pass::buy_hint` at half price
/// (avoids a circular Move dependency: season_pass → hint_shop already).
module sudoku::season_pass {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use sudoku::hint_shop;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_ACTIVE: u64 = 2;
    const E_PASS_INACTIVE: u64 = 3;

    /// Default 30 days in seconds.
    const PASS_DURATION_SECS: u64 = 30 * 24 * 60 * 60;
    /// 0.1 sUSD @ 8 decimals.
    const PRICE_RAW: u64 = 10_000_000;

    const HARDCODED_SHELBY_USD_METADATA: address = @0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1;

    struct PassStore has key {
        owners: vector<address>,
        expires_at: vector<u64>,
    }

    #[event]
    struct PassPurchased has drop, store {
        buyer: address,
        price_micro: u64,
        expires_at: u64,
    }

    fun init_module(admin: &signer) {
        move_to(admin, PassStore {
            owners: vector::empty<address>(),
            expires_at: vector::empty<u64>(),
        });
    }

    fun shelby_usd_metadata(): Object<Metadata> {
        object::address_to_object<Metadata>(HARDCODED_SHELBY_USD_METADATA)
    }

    fun find_expiry(store: &PassStore, owner: address): u64 {
        let i = 0;
        let n = vector::length(&store.owners);
        while (i < n) {
            if (*vector::borrow(&store.owners, i) == owner) {
                return *vector::borrow(&store.expires_at, i)
            };
            i = i + 1;
        };
        0
    }

    #[view]
    public fun has_active_pass(owner: address): bool acquires PassStore {
        if (!exists<PassStore>(@sudoku)) return false;
        let store = borrow_global<PassStore>(@sudoku);
        let expires = find_expiry(store, owner);
        expires > timestamp::now_seconds()
    }

    #[view]
    public fun expires_at(owner: address): u64 acquires PassStore {
        if (!exists<PassStore>(@sudoku)) return 0;
        let store = borrow_global<PassStore>(@sudoku);
        find_expiry(store, owner)
    }

    /// Charge PRICE_RAW shelbyUSD and extend / create a 30-day pass.
    /// `price_micro` is ignored (kept for client ABI compatibility).
    public entry fun purchase(player: &signer, price_micro: u64) acquires PassStore {
        let addr = signer::address_of(player);
        assert!(exists<PassStore>(@sudoku), E_NOT_INITIALIZED);
        let store = borrow_global_mut<PassStore>(@sudoku);
        let now = timestamp::now_seconds();

        // Refuse a repurchase while an active pass remains.
        let i = 0;
        let n = vector::length(&store.owners);
        while (i < n) {
            if (*vector::borrow(&store.owners, i) == addr) {
                assert!(*vector::borrow(&store.expires_at, i) <= now, E_ALREADY_ACTIVE);
                break
            };
            i = i + 1;
        };

        let treasury = hint_shop::treasury_address();
        let metadata = shelby_usd_metadata();
        // Charge the constant price; ignore client-supplied price_micro.
        let _ignored = price_micro;
        primary_fungible_store::transfer(player, metadata, treasury, PRICE_RAW);

        let expires = now + PASS_DURATION_SECS;
        let j = 0;
        let m = vector::length(&store.owners);
        let found = false;
        while (j < m) {
            if (*vector::borrow(&store.owners, j) == addr) {
                *vector::borrow_mut(&mut store.expires_at, j) = expires;
                found = true;
                break
            };
            j = j + 1;
        };
        if (!found) {
            vector::push_back(&mut store.owners, addr);
            vector::push_back(&mut store.expires_at, expires);
        };

        event::emit(PassPurchased {
            buyer: addr,
            price_micro: PRICE_RAW,
            expires_at: expires,
        });
    }

    /// Buy a hint at half price while the pass is active.
    public entry fun buy_hint(player: &signer, level: u64) acquires PassStore {
        let addr = signer::address_of(player);
        assert!(has_active_pass(addr), E_PASS_INACTIVE);
        hint_shop::buy_hint_priced(player, level, hint_shop::pass_price_raw());
    }
}
