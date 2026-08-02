/// Referral codes — optional on-chain register for bonus payouts.
/// TODO(deployer): pay shelbyUSD to referrer + referee from treasury.
module sudoku::referral {
    use std::signer;
    use std::vector;
    use aptos_framework::event;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_REGISTERED: u64 = 2;

    struct ReferralStore has key {
        referees: vector<address>,
        codes: vector<vector<u8>>,
        referrer_hints: vector<vector<u8>>,
    }

    #[event]
    struct ReferralRegistered has drop, store {
        referee: address,
        code: vector<u8>,
        referrer_hint: vector<u8>,
    }

    fun init_module(admin: &signer) {
        move_to(admin, ReferralStore {
            referees: vector::empty<address>(),
            codes: vector::empty<vector<u8>>(),
            referrer_hints: vector::empty<vector<u8>>(),
        });
    }

    public entry fun register(
        player: &signer,
        code: vector<u8>,
        referrer_hint: vector<u8>,
    ) acquires ReferralStore {
        let addr = signer::address_of(player);
        assert!(exists<ReferralStore>(@sudoku), E_NOT_INITIALIZED);
        let store = borrow_global_mut<ReferralStore>(@sudoku);

        let i = 0;
        let n = vector::length(&store.referees);
        while (i < n) {
            assert!(*vector::borrow(&store.referees, i) != addr, E_ALREADY_REGISTERED);
            i = i + 1;
        };

        let code_ev = copy code;
        let hint_ev = copy referrer_hint;
        vector::push_back(&mut store.referees, addr);
        vector::push_back(&mut store.codes, code);
        vector::push_back(&mut store.referrer_hints, referrer_hint);

        event::emit(ReferralRegistered {
            referee: addr,
            code: code_ev,
            referrer_hint: hint_ev,
        });
    }
}
