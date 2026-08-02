/// Milestone NFT badges for Sudoku on Shelby.
/// TODO(deployer): wire real Digital Asset / Token standard + collection address.
/// TODO(deployer): upload badge metadata JSON to Shelby and pass blob name on mint.
module sudoku::nft_badge {
    use std::signer;
    use std::vector;
    use aptos_framework::event;

    const E_ALREADY_MINTED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;

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
        let blob_ev = copy metadata_blob;
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
    }
}
