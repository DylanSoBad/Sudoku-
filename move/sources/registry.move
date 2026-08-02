/// Registry of puzzle blobs published by the curator.
/// Maps `(level, epoch_day)` to a blob name + merkle root on Shelby.
module sudoku::registry {
    use aptos_framework::event;
    use std::signer;
    use std::vector;

    struct PuzzleRef has copy, drop, store {
        level: u64,
        epoch_day: u64,
        blob_name: vector<u8>,
        merkle_root: vector<u8>,
        ts_ms: u64,
    }

    struct PuzzleRegistry has key {
        entries: vector<PuzzleRef>,
    }

    #[event]
    struct PuzzleRegistered has drop, store { level: u64, blob_name: vector<u8> }

    public entry fun init(account: &signer) {
        move_to(account, PuzzleRegistry { entries: vector::empty<PuzzleRef>() });
    }

    public entry fun register_puzzle(
        curator: &signer,
        level: u64,
        epoch_day: u64,
        blob_name: vector<u8>,
        merkle_root: vector<u8>,
        ts_ms: u64,
    ) acquires PuzzleRegistry {
        let addr = signer::address_of(curator);
        let reg = borrow_global_mut<PuzzleRegistry>(addr);
        let entry = PuzzleRef { level, epoch_day, blob_name, merkle_root, ts_ms };
        vector::push_back(&mut reg.entries, entry);
        event::emit(PuzzleRegistered { level, blob_name });
    }

    #[view]
    public fun latest_for_level(addr: address, level: u64): (vector<u8>, vector<u8>, u64) acquires PuzzleRegistry {
        let reg = borrow_global<PuzzleRegistry>(addr);
        let n = vector::length(&reg.entries);
        let i = n;
        let out_name = vector::empty<u8>();
        let out_root = vector::empty<u8>();
        let out_ts: u64 = 0;
        while (i > 0) {
            i = i - 1;
            let e = vector::borrow(&reg.entries, i);
            if (e.level == level) {
                out_name = e.blob_name;
                out_root = e.merkle_root;
                out_ts = e.ts_ms;
                break
            }
        };
        (out_name, out_root, out_ts)
    }
}
