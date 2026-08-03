/// On-chain registry of Sudoku puzzles stored on Shelby. Each puzzle
/// commits to a blob_name + a small commitment (Merkle root or hash) so
/// off-chain consumers can verify the blob they download.
module sudoku::registry {
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};
    use std::string::String;

    struct Puzzle has key, store, copy, drop {
        level: u64,
        blob_name: String,
        commitment: vector<u8>,
    }

    struct Registry has key {
        puzzles: Table<u64, Puzzle>,
    }

    #[event]
    struct PuzzleRegistered has drop, store { level: u64, blob_name: String, commitment: vector<u8> }

    public entry fun init(admin: &signer) {
        move_to(admin, Registry { puzzles: table::new<u64, Puzzle>() });
    }

    public entry fun register_puzzle(
        admin: &signer,
        level: u64,
        blob_name: String,
        commitment: vector<u8>,
    ) acquires Registry {
        let r = borrow_global_mut<Registry>(@sudoku);
        if (table::contains(&r.puzzles, level)) {
            table::remove(&mut r.puzzles, level);
        };
        let p = Puzzle { level, blob_name, commitment };
        table::add(&mut r.puzzles, level, p);
        event::emit(PuzzleRegistered { level, blob_name, commitment });
    }

    public fun get_blob_name(level: u64): String acquires Registry {
        let r = borrow_global<Registry>(@sudoku);
        let p = table::borrow(&r.puzzles, level);
        p.blob_name
    }

    public fun get_commitment(level: u64): vector<u8> acquires Registry {
        let r = borrow_global<Registry>(@sudoku);
        let p = table::borrow(&r.puzzles, level);
        p.commitment
    }
}
