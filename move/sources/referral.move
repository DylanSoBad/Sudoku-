/// Referral codes — register once and pay both sides from the rewards treasury.
///
/// Flow:
///   1. Referrer calls `publish_code(code)` so the short code maps to their address.
///   2. Referee calls `register(code, referrer_hint)` (hint kept for ABI compat).
///   3. Both receive REFERRAL_BONUS_RAW (0.01 sUSD) from rewards::pay_bonus.
///
/// Existing `ReferralStore` layout is unchanged for compatible upgrades.
/// New resources: `CodeIndex`, `ReferralPayouts`.
module sudoku::referral {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};
    use sudoku::rewards;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_REGISTERED: u64 = 2;
    const E_CODE_UNKNOWN: u64 = 3;
    const E_SELF_REFERRAL: u64 = 4;
    const E_ALREADY_PAID: u64 = 5;

    struct ReferralStore has key {
        referees: vector<address>,
        codes: vector<vector<u8>>,
        referrer_hints: vector<vector<u8>>,
    }

    /// Maps invite code bytes → referrer address. Created on first publish_code.
    struct CodeIndex has key {
        codes: Table<vector<u8>, address>,
    }

    /// Tracks whether a referee has already been paid (one bonus per wallet).
    struct ReferralPayouts has key {
        paid: Table<address, bool>,
    }

    #[event]
    struct ReferralRegistered has drop, store {
        referee: address,
        code: vector<u8>,
        referrer_hint: vector<u8>,
    }

    #[event]
    struct ReferralPaid has drop, store {
        referee: address,
        referrer: address,
        amount_each: u64,
    }

    fun init_module(admin: &signer) {
        move_to(admin, ReferralStore {
            referees: vector::empty<address>(),
            codes: vector::empty<vector<u8>>(),
            referrer_hints: vector::empty<vector<u8>>(),
        });
        move_to(admin, CodeIndex { codes: table::new<vector<u8>, address>() });
        move_to(admin, ReferralPayouts { paid: table::new<address, bool>() });
    }

    /// Bind an invite code to the caller's address. Overwrites if the caller
    /// re-publishes the same code; aborts if another wallet already owns it.
    public entry fun publish_code(player: &signer, code: vector<u8>) acquires CodeIndex {
        ensure_index();
        let addr = signer::address_of(player);
        let index = borrow_global_mut<CodeIndex>(@sudoku);
        if (table::contains(&index.codes, code)) {
            let owner = *table::borrow(&index.codes, code);
            assert!(owner == addr, E_ALREADY_REGISTERED);
        } else {
            table::add(&mut index.codes, code, addr);
        };
    }

    public entry fun register(
        player: &signer,
        code: vector<u8>,
        referrer_hint: vector<u8>,
    ) acquires ReferralStore, CodeIndex, ReferralPayouts {
        let addr = signer::address_of(player);
        assert!(exists<ReferralStore>(@sudoku), E_NOT_INITIALIZED);
        ensure_index();
        ensure_payouts();

        let store = borrow_global_mut<ReferralStore>(@sudoku);
        let i = 0;
        let n = vector::length(&store.referees);
        while (i < n) {
            assert!(*vector::borrow(&store.referees, i) != addr, E_ALREADY_REGISTERED);
            i = i + 1;
        };

        let index = borrow_global<CodeIndex>(@sudoku);
        assert!(table::contains(&index.codes, code), E_CODE_UNKNOWN);
        let referrer = *table::borrow(&index.codes, code);
        assert!(referrer != addr, E_SELF_REFERRAL);

        let payouts = borrow_global_mut<ReferralPayouts>(@sudoku);
        assert!(!table::contains(&payouts.paid, addr), E_ALREADY_PAID);

        let code_ev = copy code;
        let hint_ev = copy referrer_hint;
        vector::push_back(&mut store.referees, addr);
        vector::push_back(&mut store.codes, code);
        vector::push_back(&mut store.referrer_hints, referrer_hint);

        let bonus = rewards::referral_bonus_raw();
        rewards::pay_bonus(addr, bonus);
        rewards::pay_bonus(referrer, bonus);
        table::add(&mut payouts.paid, addr, true);

        event::emit(ReferralRegistered {
            referee: addr,
            code: code_ev,
            referrer_hint: hint_ev,
        });
        event::emit(ReferralPaid {
            referee: addr,
            referrer,
            amount_each: bonus,
        });
    }

    fun ensure_index() {
        // Compatible upgrade path: resource may be missing on old packages.
        // Call init_payouts_and_index as admin once after upgrading.
        assert!(exists<CodeIndex>(@sudoku), E_NOT_INITIALIZED);
    }

    fun ensure_payouts() {
        assert!(exists<ReferralPayouts>(@sudoku), E_NOT_INITIALIZED);
    }

    /// One-shot admin init for resources added in a compatible upgrade.
    /// Safe to call only when CodeIndex / ReferralPayouts are absent.
    public entry fun init_payouts_and_index(admin: &signer) {
        assert!(signer::address_of(admin) == @sudoku, E_NOT_INITIALIZED);
        if (!exists<CodeIndex>(@sudoku)) {
            move_to(admin, CodeIndex { codes: table::new<vector<u8>, address>() });
        };
        if (!exists<ReferralPayouts>(@sudoku)) {
            move_to(admin, ReferralPayouts { paid: table::new<address, bool>() });
        };
    }
}
