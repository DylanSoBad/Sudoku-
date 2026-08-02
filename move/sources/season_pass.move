/// Season Pass: paid unlock for discounted hints + cosmetics.
/// TODO(deployer): charge real shelbyUSD and persist expiry on-chain.
module sudoku::season_pass {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;

    const E_NOT_INITIALIZED: u64 = 1;
    /// Default 30 days in seconds.
    const PASS_DURATION_SECS: u64 = 30 * 24 * 60 * 60;

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

    /// Skeleton purchase — TODO(deployer): withdraw shelbyUSD from buyer.
    public entry fun purchase(player: &signer, price_micro: u64) acquires PassStore {
        let addr = signer::address_of(player);
        assert!(exists<PassStore>(@sudoku), E_NOT_INITIALIZED);
        let store = borrow_global_mut<PassStore>(@sudoku);
        let now = timestamp::now_seconds();
        let expires = now + PASS_DURATION_SECS;

        let i = 0;
        let n = vector::length(&store.owners);
        let found = false;
        while (i < n) {
            if (*vector::borrow(&store.owners, i) == addr) {
                *vector::borrow_mut(&mut store.expires_at, i) = expires;
                found = true;
                break
            };
            i = i + 1;
        };
        if (!found) {
            vector::push_back(&mut store.owners, addr);
            vector::push_back(&mut store.expires_at, expires);
        };

        event::emit(PassPurchased {
            buyer: addr,
            price_micro,
            expires_at: expires,
        });
    }
}
