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
///
/// # Payout authorisation
///
/// The puzzle blob (and therefore its solution) is public, so "player knows
/// the solution" is not provable on-chain. Payouts are instead authorised by
/// an off-chain verifier: the app checks the submitted grid, then signs a
/// single-use ticket `(player, level, expires_at, nonce)` with the Ed25519 key
/// whose public half is stored in `ClaimGuard`. `claim_with_proof` verifies it.
///
/// `ClaimGuard` also enforces a rolling 24h payout budget over every treasury
/// outflow (claims and referral bonuses), so even a compromised verifier or a
/// sybil farm cannot drain the treasury in one pass.
module sudoku::rewards {
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_std::ed25519;
    use aptos_std::table::{Self, Table};
    use std::bcs;
    use std::signer;
    use std::vector;

    friend sudoku::referral;

    const HARDCODED_SHELBY_USD_METADATA: address = @0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1;

    /// Flat reward in raw sUSD (8 decimals) = 0.01 sUSD.
    const REWARD_RAW: u64 = 1_000_000;
    /// Daily challenge (level 0) pays 2x.
    const DAILY_REWARD_RAW: u64 = 2_000_000;
    /// Per-side referral bonus = 0.01 sUSD.
    const REFERRAL_BONUS_RAW: u64 = 1_000_000;

    /// Rolling payout window for the treasury budget.
    const WINDOW_SECS: u64 = 86_400;
    /// Tickets must be short-lived so a leaked one cannot be replayed later.
    const MAX_TICKET_TTL_SECS: u64 = 900;

    /// Domain separator — off-chain signer must use the same prefix.
    const CLAIM_DOMAIN: vector<u8> = b"SUDOKU_CLAIM_V1";

    const E_ALREADY_CLAIMED: u64 = 1001;
    const E_NOT_ADMIN: u64 = 1002;
    const E_GUARD_MISSING: u64 = 1003;
    const E_PROOF_REQUIRED: u64 = 1004;
    const E_TICKET_EXPIRED: u64 = 1005;
    const E_BAD_SIGNATURE: u64 = 1006;
    const E_NONCE_USED: u64 = 1007;
    const E_DAILY_CAP: u64 = 1008;
    const E_GUARD_EXISTS: u64 = 1009;

    struct Rewards has key {
        treasury_signer_cap: account::SignerCapability,
        claimed: Table<address, Table<u64, bool>>,
    }

    /// Added in a compatible upgrade — call `init_claim_guard` once as admin.
    struct ClaimGuard has key {
        /// Ed25519 public key (32 bytes) of the off-chain claim verifier.
        verifier: vector<u8>,
        /// When true, the unauthenticated `claim` entry is disabled.
        require_proof: bool,
        used_nonces: Table<u64, bool>,
        window_start_secs: u64,
        paid_in_window: u64,
        daily_cap_raw: u64,
    }

    #[event]
    struct RewardClaimed has drop, store { player: address, level: u64, amount: u64 }

    public entry fun init(admin: &signer) {
        let seed = b"shelby-sudoku-rewards";
        let (_treasury_signer, cap) = account::create_resource_account(admin, seed);
        let claimed = table::new<address, Table<u64, bool>>();
        move_to(admin, Rewards { treasury_signer_cap: cap, claimed });
    }

    /// One-shot admin init for the guard added in a compatible upgrade.
    public entry fun init_claim_guard(
        admin: &signer,
        verifier: vector<u8>,
        daily_cap_raw: u64,
        require_proof: bool,
    ) {
        assert!(signer::address_of(admin) == @sudoku, E_NOT_ADMIN);
        assert!(!exists<ClaimGuard>(@sudoku), E_GUARD_EXISTS);
        move_to(admin, ClaimGuard {
            verifier,
            require_proof,
            used_nonces: table::new<u64, bool>(),
            window_start_secs: timestamp::now_seconds(),
            paid_in_window: 0,
            daily_cap_raw,
        });
    }

    public entry fun set_verifier(admin: &signer, verifier: vector<u8>) acquires ClaimGuard {
        assert!(signer::address_of(admin) == @sudoku, E_NOT_ADMIN);
        assert!(exists<ClaimGuard>(@sudoku), E_GUARD_MISSING);
        borrow_global_mut<ClaimGuard>(@sudoku).verifier = verifier;
    }

    public entry fun set_require_proof(admin: &signer, required: bool) acquires ClaimGuard {
        assert!(signer::address_of(admin) == @sudoku, E_NOT_ADMIN);
        assert!(exists<ClaimGuard>(@sudoku), E_GUARD_MISSING);
        borrow_global_mut<ClaimGuard>(@sudoku).require_proof = required;
    }

    public entry fun set_daily_cap(admin: &signer, cap_raw: u64) acquires ClaimGuard {
        assert!(signer::address_of(admin) == @sudoku, E_NOT_ADMIN);
        assert!(exists<ClaimGuard>(@sudoku), E_GUARD_MISSING);
        borrow_global_mut<ClaimGuard>(@sudoku).daily_cap_raw = cap_raw;
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

    #[view]
    public fun has_claimed(player: address, level: u64): bool acquires Rewards {
        if (!exists<Rewards>(@sudoku)) return false;
        let r = borrow_global<Rewards>(@sudoku);
        player_claimed(r, player, level)
    }

    // True when the player has claimed at least one level (0-20). Used by
    // `referral` so a fresh wallet cannot farm bonuses without playing.
    #[view]
    public fun has_any_claim(player: address): bool acquires Rewards {
        if (!exists<Rewards>(@sudoku)) return false;
        let r = borrow_global<Rewards>(@sudoku);
        if (!table::contains(&r.claimed, player)) return false;
        let inner = table::borrow(&r.claimed, player);
        let lvl = 0;
        while (lvl <= 20) {
            if (table::contains(inner, lvl) && *table::borrow(inner, lvl)) {
                return true
            };
            lvl = lvl + 1;
        };
        false
    }

    #[view]
    public fun proof_required(): bool acquires ClaimGuard {
        if (!exists<ClaimGuard>(@sudoku)) return false;
        borrow_global<ClaimGuard>(@sudoku).require_proof
    }

    // Free pre-flight for the client (and a byte-layout check for the signer).
    #[view]
    public fun verify_claim_ticket(
        player: address,
        level: u64,
        expires_at_secs: u64,
        nonce: u64,
        signature: vector<u8>,
    ): bool acquires ClaimGuard {
        if (!exists<ClaimGuard>(@sudoku)) return false;
        let g = borrow_global<ClaimGuard>(@sudoku);
        verify_ticket(g, player, level, expires_at_secs, nonce, signature)
    }

    #[view]
    public fun budget_remaining(): u64 acquires ClaimGuard {
        if (!exists<ClaimGuard>(@sudoku)) return 0;
        let g = borrow_global<ClaimGuard>(@sudoku);
        let now = timestamp::now_seconds();
        if (now >= g.window_start_secs + WINDOW_SECS) {
            return g.daily_cap_raw
        };
        if (g.paid_in_window >= g.daily_cap_raw) {
            0
        } else {
            g.daily_cap_raw - g.paid_in_window
        }
    }

    #[view]
    public fun treasury_address(): address acquires Rewards {
        let r = borrow_global<Rewards>(@sudoku);
        account::get_signer_capability_address(&r.treasury_signer_cap)
    }

    public entry fun top_up_treasury(admin: &signer, amount: u64) acquires Rewards {
        let r = borrow_global<Rewards>(@sudoku);
        let treasury_addr = account::get_signer_capability_address(&r.treasury_signer_cap);
        let metadata = shelby_usd_metadata();
        primary_fungible_store::transfer(admin, metadata, treasury_addr, amount);
    }

    /// Charge the rolling 24h treasury budget. No-op before the guard exists
    /// so the upgrade cannot brick payouts before `init_claim_guard` runs.
    fun spend_budget(amount: u64) acquires ClaimGuard {
        if (!exists<ClaimGuard>(@sudoku)) return;
        let g = borrow_global_mut<ClaimGuard>(@sudoku);
        let now = timestamp::now_seconds();
        if (now >= g.window_start_secs + WINDOW_SECS) {
            g.window_start_secs = now;
            g.paid_in_window = 0;
        };
        assert!(g.paid_in_window + amount <= g.daily_cap_raw, E_DAILY_CAP);
        g.paid_in_window = g.paid_in_window + amount;
    }

    /// Bytes the off-chain verifier signs. Layout:
    ///   b"SUDOKU_CLAIM_V1" | bcs(address) | bcs(level) | bcs(expires) | bcs(nonce)
    fun claim_message(
        player: address,
        level: u64,
        expires_at_secs: u64,
        nonce: u64,
    ): vector<u8> {
        let msg = CLAIM_DOMAIN;
        vector::append(&mut msg, bcs::to_bytes(&player));
        vector::append(&mut msg, bcs::to_bytes(&level));
        vector::append(&mut msg, bcs::to_bytes(&expires_at_secs));
        vector::append(&mut msg, bcs::to_bytes(&nonce));
        msg
    }

    fun verify_ticket(
        g: &ClaimGuard,
        player: address,
        level: u64,
        expires_at_secs: u64,
        nonce: u64,
        signature: vector<u8>,
    ): bool {
        if (vector::length(&g.verifier) != 32) return false;
        if (vector::length(&signature) != 64) return false;
        let msg = claim_message(player, level, expires_at_secs, nonce);
        let pk = ed25519::new_unvalidated_public_key_from_bytes(g.verifier);
        let sig = ed25519::new_signature_from_bytes(signature);
        ed25519::signature_verify_strict(&sig, &pk, msg)
    }

    fun pay_claim(player_addr: address, level: u64) acquires Rewards, ClaimGuard {
        let amount = reward_for(level);
        spend_budget(amount);
        let r = borrow_global_mut<Rewards>(@sudoku);
        assert!(!player_claimed(r, player_addr, level), E_ALREADY_CLAIMED);
        let metadata = shelby_usd_metadata();
        let treasury_signer = account::create_signer_with_capability(&r.treasury_signer_cap);
        primary_fungible_store::transfer(&treasury_signer, metadata, player_addr, amount);
        mark_claimed(r, player_addr, level);
        event::emit(RewardClaimed { player: player_addr, level, amount });
    }

    /// Legacy unauthenticated claim. Disabled once `require_proof` is on;
    /// kept for upgrade compatibility (public signatures cannot be removed).
    public entry fun claim(player: &signer, level: u64) acquires Rewards, ClaimGuard {
        assert!(!proof_required(), E_PROOF_REQUIRED);
        pay_claim(signer::address_of(player), level);
    }

    /// Claim with a single-use ticket signed by the off-chain verifier.
    public entry fun claim_with_proof(
        player: &signer,
        level: u64,
        expires_at_secs: u64,
        nonce: u64,
        signature: vector<u8>,
    ) acquires Rewards, ClaimGuard {
        assert!(exists<ClaimGuard>(@sudoku), E_GUARD_MISSING);
        let player_addr = signer::address_of(player);
        let now = timestamp::now_seconds();
        assert!(now <= expires_at_secs, E_TICKET_EXPIRED);
        assert!(expires_at_secs <= now + MAX_TICKET_TTL_SECS, E_TICKET_EXPIRED);

        let g = borrow_global_mut<ClaimGuard>(@sudoku);
        assert!(!table::contains(&g.used_nonces, nonce), E_NONCE_USED);
        assert!(
            verify_ticket(g, player_addr, level, expires_at_secs, nonce, signature),
            E_BAD_SIGNATURE,
        );
        table::add(&mut g.used_nonces, nonce, true);

        pay_claim(player_addr, level);
    }

    /// Pay a flat referral bonus from the rewards treasury. Only callable by
    /// `sudoku::referral` so random clients cannot drain the pool.
    public(friend) fun pay_bonus(to: address, amount: u64) acquires Rewards, ClaimGuard {
        spend_budget(amount);
        let r = borrow_global<Rewards>(@sudoku);
        let metadata = shelby_usd_metadata();
        let treasury_signer = account::create_signer_with_capability(&r.treasury_signer_cap);
        primary_fungible_store::transfer(&treasury_signer, metadata, to, amount);
    }

    public fun referral_bonus_raw(): u64 {
        REFERRAL_BONUS_RAW
    }
}
