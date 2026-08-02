/// Rewards module: pays out shelbyUSD from a treasury on level clear.
module sudoku::rewards {
    use aptos_framework::coin;
    use aptos_framework::event;
    use std::signer;

    // TODO(deployer): replace with FA metadata for shelbyUSD on testnet.
    const SHELBYUSD_METADATA: address = @0x0;

    struct Rewards has key {
        treasury: address,
        pool: u64,
        paid_out: u64,
    }

    #[event]
    struct Rewarded has drop, store { player: address, level: u64, amount: u64 }

    public entry fun init(admin: &signer, treasury: address) {
        move_to(admin, Rewards { treasury, pool: 0, paid_out: 0 });
    }

    public fun reward_amount(level: u64): u64 {
        if (level <= 3) 500_000
        else if (level <= 6) 1_000_000
        else if (level <= 10) 2_500_000
        else if (level <= 14) 5_000_000
        else 10_000_000
    }

    public entry fun top_up_treasury(admin: &signer, amount: u64) acquires Rewards {
        let r = borrow_global_mut<Rewards>(signer::address_of(admin));
        let coin = coin::withdraw<SHELBYUSD>(admin, amount);
        coin::deposit(r.treasury, coin);
        r.pool = r.pool + amount;
    }

    public entry fun claim(player: &signer, treasury_addr: address, level: u64) acquires Rewards {
        let r = borrow_global_mut<Rewards>(treasury_addr);
        let amt = reward_amount(level);
        let coin = coin::withdraw<SHELBYUSD>(treasury_addr, amt);
        coin::deposit(signer::address_of(player), coin);
        r.paid_out = r.paid_out + amt;
        event::emit(Rewarded { player: signer::address_of(player), level, amount: amt });
    }
}
