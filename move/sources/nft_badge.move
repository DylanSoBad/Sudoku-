/// Milestone badges for Sudoku on Shelby.
/// Records milestones in `BadgeStore` and mints an Aptos Token Objects NFT
/// under a per-player "Sudoku on Shelby" collection (created on first mint).
module sudoku::nft_badge {
    use std::option;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::object;
    use aptos_token_objects::collection;
    use aptos_token_objects::token;

    const E_ALREADY_MINTED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;

    const COLLECTION_NAME: vector<u8> = b"Sudoku on Shelby";
    const COLLECTION_DESC: vector<u8> = b"Milestone badges for Sudoku on Shelby";
    const COLLECTION_URI: vector<u8> = b"https://sudoku-d.vercel.app";

    struct BadgeStore has key {
        /// Parallel vectors: owner, milestone_id bytes, level
        owners: vector<address>,
        milestone_ids: vector<vector<u8>>,
        levels: vector<u16>,
        metadata_blobs: vector<vector<u8>>,
    }

    #[event]
    struct MilestoneMinted has drop, store {
        owner: address,
        milestone_id: vector<u8>,
        level: u16,
        metadata_blob: vector<u8>,
    }

    #[event]
    struct MilestoneTokenMinted has drop, store {
        owner: address,
        milestone_id: vector<u8>,
        level: u16,
        token_address: address,
    }

    fun init_module(admin: &signer) {
        move_to(admin, BadgeStore {
            owners: vector::empty<address>(),
            milestone_ids: vector::empty<vector<u8>>(),
            levels: vector::empty<u16>(),
            metadata_blobs: vector::empty<vector<u8>>(),
        });
    }

    fun already_has(store: &BadgeStore, owner: address, milestone_id: &vector<u8>): bool {
        let i = 0;
        let n = vector::length(&store.owners);
        while (i < n) {
            if (*vector::borrow(&store.owners, i) == owner
                && *vector::borrow(&store.milestone_ids, i) == *milestone_id) {
                return true
            };
            i = i + 1;
        };
        false
    }

    fun ensure_collection(player: &signer) {
        let creator = signer::address_of(player);
        let name = string::utf8(COLLECTION_NAME);
        let collection_addr = collection::create_collection_address(&creator, &name);
        if (!object::object_exists<collection::Collection>(collection_addr)) {
            collection::create_unlimited_collection(
                player,
                string::utf8(COLLECTION_DESC),
                name,
                option::none(),
                string::utf8(COLLECTION_URI),
            );
        };
    }

    fun token_name(milestone_id: &vector<u8>, level: u16): String {
        let name = string::utf8(b"Badge ");
        string::append(&mut name, string::utf8(*milestone_id));
        string::append(&mut name, string::utf8(b" L"));
        // Compact decimal for level (0–20).
        if (level >= 10) {
            let tens = ((level as u64) / 10) as u8;
            let ones = ((level as u64) % 10) as u8;
            let digits = vector::empty<u8>();
            vector::push_back(&mut digits, 48 + tens);
            vector::push_back(&mut digits, 48 + ones);
            string::append(&mut name, string::utf8(digits));
        } else {
            let digits = vector::empty<u8>();
            vector::push_back(&mut digits, 48 + (level as u8));
            string::append(&mut name, string::utf8(digits));
        };
        name
    }

    fun mint_token(
        player: &signer,
        milestone_id: &vector<u8>,
        level: u16,
        metadata_blob: &vector<u8>,
    ): address {
        ensure_collection(player);
        let uri = if (vector::length(metadata_blob) > 0) {
            string::utf8(*metadata_blob)
        } else {
            string::utf8(COLLECTION_URI)
        };
        let ctor = token::create(
            player,
            string::utf8(COLLECTION_NAME),
            string::utf8(b"Sudoku milestone badge"),
            token_name(milestone_id, level),
            option::none(),
            uri,
        );
        object::address_from_constructor_ref(&ctor)
    }

    /// Mint a milestone badge for the signer. Client passes milestone id + level + Shelby blob name.
    public entry fun mint_milestone(
        player: &signer,
        milestone_id: vector<u8>,
        level: u16,
        metadata_blob: vector<u8>,
    ) acquires BadgeStore {
        let addr = signer::address_of(player);
        assert!(exists<BadgeStore>(@sudoku), E_NOT_INITIALIZED);
        let store = borrow_global_mut<BadgeStore>(@sudoku);
        assert!(!already_has(store, addr, &milestone_id), E_ALREADY_MINTED);

        let mid_ev = copy milestone_id;
        let mid_tok = copy milestone_id;
        let blob_ev = copy metadata_blob;
        let token_address = mint_token(player, &milestone_id, level, &metadata_blob);

        vector::push_back(&mut store.owners, addr);
        vector::push_back(&mut store.milestone_ids, milestone_id);
        vector::push_back(&mut store.levels, level);
        vector::push_back(&mut store.metadata_blobs, metadata_blob);

        event::emit(MilestoneMinted {
            owner: addr,
            milestone_id: mid_ev,
            level,
            metadata_blob: blob_ev,
        });
        event::emit(MilestoneTokenMinted {
            owner: addr,
            milestone_id: mid_tok,
            level,
            token_address,
        });
    }

    #[view]
    public fun has_badge(owner: address, milestone_id: vector<u8>): bool acquires BadgeStore {
        if (!exists<BadgeStore>(@sudoku)) return false;
        let store = borrow_global<BadgeStore>(@sudoku);
        already_has(store, owner, &milestone_id)
    }

    #[view]
    public fun badge_count(owner: address): u64 acquires BadgeStore {
        if (!exists<BadgeStore>(@sudoku)) return 0;
        let store = borrow_global<BadgeStore>(@sudoku);
        let i = 0;
        let n = vector::length(&store.owners);
        let count = 0u64;
        while (i < n) {
            if (*vector::borrow(&store.owners, i) == owner) {
                count = count + 1;
            };
            i = i + 1;
        };
        count
    }
}
