/// Season Pass: paid unlock for discounted hints + cosmetics.
///
/// Charge is a flat 0.1 sUSD (10_000_000 raw @ 8 decimals), paid to the
/// hint_shop treasury. The `price_micro` argument is accepted for ABI
/// compatibility with existing clients but is ignored — the on-chain
/// constant is the source of truth.
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
}
