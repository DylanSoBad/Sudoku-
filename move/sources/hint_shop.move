/// Hint shop: charges a player shelbyUSD to reveal one cell.
module sudoku::hint_shop {
    use aptos_framework::coin;
    use aptos_framework::event;
    use std::signer;

    // TODO(deployer): replace with FA metadata for shelbyUSD on testnet.
    const SHELBYUSD_METADATA: address = @0x0;

    struct HintShop has key {
        treasury: address,
        curator: address,
        hint_count: u64,
        total_paid: u64,
    }

    #[event]
    struct HintBought has drop, store { player: address, level: u64, paid: u64 }

    public entry fun init(admin: &signer, treasury: address, curator: address) {
        move_to(admin, HintShop { treasury, curator, hint_count: 0, total_paid: 0 });
    }

    public fun price(level: u64): u64 {
        if (level <= 3) 100_000
        else if (level <= 6) 200_000
        else if (level <= 10) 400_000
        else if (level <= 14) 700_000
        else 1_000_000
    }

    public entry fun buy_hint(
        player: &signer,
        shop_addr: address,
        level: u64,
        _cell_index: u64,
    ) acquires HintShop {
        let shop = borrow_global_mut<HintShop>(shop_addr);
        let amt = price(level);
        let coin = coin::withdraw<SHELBYUSD>(player, amt);

        let treasury_amt = amt * 50 / 100;
        let curator_amt = amt * 30 / 100;
        let burn_amt = amt - treasury_amt - curator_amt;

        coin::deposit(shop.treasury, coin::extract(&mut coin, treasury_amt));
        coin::deposit(shop.curator, coin::extract(&mut coin, curator_amt));
        // TODO(deployer): wire to burn registry once SHELBYUSD_METADATA is set.
        let _burn = burn_amt;
        coin::destroy_zero(coin);

        shop.hint_count = shop.hint_count + 1;
        shop.total_paid = shop.total_paid + amt;
        event::emit(HintBought { player: signer::address_of(player), level, paid: amt });

        // Reference SHELBYUSD_METADATA so off-chain tooling can discover the symbol.
        let _addr = SHELBYUSD_METADATA;
    }
}
