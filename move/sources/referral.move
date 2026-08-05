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
    /// Referee has not cleared and claimed a level yet.
    const E_NO_PROGRESS: u64 = 6;
    /// Referrer hit the lifetime referral payout cap.
    const E_REFERRER_CAP: u64 = 7;
    const E_CODE_INVALID: u64 = 8;

    /// Lifetime paid referrals per referrer — bounds sybil farming.
    const MAX_REFERRALS_PER_REFERRER: u64 = 25;
    const MIN_CODE_LEN: u64 = 4;
    const MAX_CODE_LEN: u64 = 32;

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

    /// Paid referral count per referrer. Added in a compatible upgrade.
    struct ReferrerCounts has key {
        counts: Table<address, u64>,
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
        move_to(admin, ReferrerCounts { counts: table::new<address, u64>() });
    }

    /// Bind an invite code to the caller's address. Overwrites if the caller
    /// re-publishes the same code; aborts if another wallet already owns it.
    public entry fun publish_code(player: &signer, code: vector<u8>) acquires CodeIndex {
        ensure_index();
        let len = vector::length(&code);
        assert!(len >= MIN_CODE_LEN && len <= MAX_CODE_LEN, E_CODE_INVALID);
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
    ) acquires ReferralStore, CodeIndex, ReferralPayouts, ReferrerCounts {
        let addr = signer::address_of(player);
        assert!(exists<ReferralStore>(@sudoku), E_NOT_INITIALIZED);
        ensure_index();
        ensure_payouts();
        assert!(exists<ReferrerCounts>(@sudoku), E_NOT_INITIALIZED);
        // A wallet must have cleared and claimed a level before it can be
        // counted as a referral — otherwise fresh wallets farm the treasury.
        assert!(rewards::has_any_claim(addr), E_NO_PROGRESS);

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

        let counts = borrow_global_mut<ReferrerCounts>(@sudoku);
        let used = if (table::contains(&counts.counts, referrer)) {
            *table::borrow(&counts.counts, referrer)
        } else {
            0
        };
        assert!(used < MAX_REFERRALS_PER_REFERRER, E_REFERRER_CAP);
        if (table::contains(&counts.counts, referrer)) {
            *table::borrow_mut(&mut counts.counts, referrer) = used + 1;
        } else {
            table::add(&mut counts.counts, referrer, 1);
        };

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
        if (!exists<ReferrerCounts>(@sudoku)) {
            move_to(admin, ReferrerCounts { counts: table::new<address, u64>() });
        };
    }

    #[view]
    public fun referrals_used(referrer: address): u64 acquires ReferrerCounts {
        if (!exists<ReferrerCounts>(@sudoku)) return 0;
        let counts = borrow_global<ReferrerCounts>(@sudoku);
        if (!table::contains(&counts.counts, referrer)) return 0;
        *table::borrow(&counts.counts, referrer)
    }
}
