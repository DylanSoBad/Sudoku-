import type { Locale } from "@/lib/preferences";

export type Dict = {
  nav: {
    curator: string;
    connect: string;
    map: string;
    settings: string;
    playLevel1: string;
    dailyChallenge: string;
  };
  home: {
    eyebrow: string;
    heroBadge: string;
    heroBody: string;
    footer: string;
  };
  faucet: {
    title: string;
    description: string;
    connectFirst: string;
  };
  play: {
    level: string;
    hints: string;
    reward: string;
    reset: string;
    undo: string;
    nextLevel: string;
    backToMap: string;
    solved: string;
  };
  hintShop: {
    buyHint: string;
    revealCell: string;
    revealRowCol: string;
    highlightConflicts: string;
    feeSplitTip: string;
    connectWallet: string;
  };
  reward: {
    title: string;
    available: string;
    claimed: string;
    claim: string;
    watchReplay: string;
  };
  levelMap: {
    title: string;
    description: string;
  };
  onboarding: {
    skip: string;
    next: string;
    finish: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
  };
  settings: {
    title: string;
    description: string;
    mute: string;
    muted: string;
    soundOn: string;
    theme: string;
    dark: string;
    light: string;
    language: string;
  };
  badges: {
    title: string;
    description: string;
    empty: string;
    earned: string;
  };
  referral: {
    title: string;
    description: string;
    yourCode: string;
    copy: string;
    enterCode: string;
    apply: string;
    localBonus: string;
    applied: string;
  };
  seasonPass: {
    title: string;
    description: string;
    buy: string;
    activeUntil: string;
    benefits: string;
    localPurchase: string;
  };
  tokenomics: {
    title: string;
    treasury: string;
    curator: string;
    burn: string;
  };
  wallet: {
    noWallets: string;
    getPetra: string;
  };
};

const en: Dict = {
  nav: {
    curator: "Curator",
    connect: "Connect",
    map: "Map",
    settings: "Settings",
    playLevel1: "Play Level 1",
    dailyChallenge: "Daily Challenge",
  },
  home: {
    eyebrow: "Aptos × Shelby",
    heroBadge: "Shelby hot storage · Aptos testnet",
    heroBody:
      "Every puzzle is a blob on Shelby. Buy hints with shelbyUSD, solve for rewards, climb 20+ levels of scaling difficulty.",
    footer: "Built on Aptos testnet · Blob storage via Shelby Protocol · Not financial advice",
  },
  faucet: {
    title: "Faucet",
    description: "Claim testnet APT and shelbyUSD to play.",
    connectFirst: "Connect a wallet first",
  },
  play: {
    level: "Level",
    hints: "Hints",
    reward: "Reward",
    reset: "Reset",
    undo: "Undo",
    nextLevel: "Next Level",
    backToMap: "Back to map",
    solved: "Solved",
  },
  hintShop: {
    buyHint: "Buy hint",
    revealCell: "Reveal cell",
    revealRowCol: "Reveal row/col",
    highlightConflicts: "Highlight conflicts",
    feeSplitTip: "Hint fees: 50% treasury · 30% curator · 20% burn",
    connectWallet: "Connect a wallet to buy hints",
  },
  reward: {
    title: "Puzzle solved",
    available: "Reward available",
    claimed: "Reward claimed — continue when ready",
    claim: "Claim",
    watchReplay: "Watch replay",
  },
  levelMap: {
    title: "Level map",
    description: "Unlock levels by solving. Progress is signed locally.",
  },
  onboarding: {
    skip: "Skip",
    next: "Next",
    finish: "Let's play",
    step1Title: "Connect wallet",
    step1Body: "Install Petra, Pontem, or Nightly, then connect to play on Aptos testnet.",
    step2Title: "Get faucet funds",
    step2Body: "Claim free testnet APT and shelbyUSD so you can buy hints and claim rewards.",
    step3Title: "Play Level 1",
    step3Body: "Start with an easy puzzle. Solve it to unlock the next level and earn shelbyUSD.",
  },
  settings: {
    title: "Settings",
    description: "Sound, theme, and language",
    mute: "Sound",
    muted: "Muted",
    soundOn: "On",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    language: "Language",
  },
  badges: {
    title: "Badges",
    description: "Milestone NFTs (local until Move deploy)",
    empty: "Solve levels to earn badges",
    earned: "Earned",
  },
  referral: {
    title: "Referral",
    description: "Invite friends — both get local shelbyUSD credit",
    yourCode: "Your invite code",
    copy: "Copy",
    enterCode: "Enter invite code",
    apply: "Apply",
    localBonus: "Local bonus credit",
    applied: "Referral applied",
  },
  seasonPass: {
    title: "Season Pass",
    description: "0.1 shelbyUSD / 30 days — half-price hints + board skin",
    buy: "Buy pass",
    activeUntil: "Active until",
    benefits: "Hints at half price · Season board skin",
    localPurchase: "Local pass (deploy Move for on-chain purchase)",
  },
  tokenomics: {
    title: "Hint fee split",
    treasury: "Reward treasury",
    curator: "Curator",
    burn: "Burn",
  },
  wallet: {
    noWallets:
      "No wallets detected. Install Petra, Pontem, or Nightly (Chrome extension), then refresh.",
    getPetra: "Get Petra →",
  },
};

const vi: Dict = {
  nav: {
    curator: "Curator",
    connect: "Kết nối",
    map: "Bản đồ",
    settings: "Cài đặt",
    playLevel1: "Chơi Level 1",
    dailyChallenge: "Thử thách ngày",
  },
  home: {
    eyebrow: "Aptos × Shelby",
    heroBadge: "Shelby hot storage · Aptos testnet",
    heroBody:
      "Mỗi puzzle là blob trên Shelby. Mua gợi ý bằng shelbyUSD, giải để nhận thưởng, leo 20+ level.",
    footer: "Xây trên Aptos testnet · Lưu trữ blob qua Shelby Protocol · Không phải lời khuyên tài chính",
  },
  faucet: {
    title: "Faucet",
    description: "Nhận APT và shelbyUSD testnet để chơi.",
    connectFirst: "Hãy kết nối ví trước",
  },
  play: {
    level: "Level",
    hints: "Gợi ý",
    reward: "Thưởng",
    reset: "Đặt lại",
    undo: "Hoàn tác",
    nextLevel: "Level tiếp",
    backToMap: "Về bản đồ",
    solved: "Đã giải",
  },
  hintShop: {
    buyHint: "Mua gợi ý",
    revealCell: "Mở ô",
    revealRowCol: "Mở hàng/cột",
    highlightConflicts: "Tô xung đột",
    feeSplitTip: "Phí gợi ý: 50% kho thưởng · 30% curator · 20% đốt",
    connectWallet: "Kết nối ví để mua gợi ý",
  },
  reward: {
    title: "Đã giải xong",
    available: "Có thưởng",
    claimed: "Đã nhận thưởng — tiếp tục khi sẵn sàng",
    claim: "Nhận",
    watchReplay: "Xem replay",
  },
  levelMap: {
    title: "Bản đồ level",
    description: "Mở khóa bằng cách giải. Tiến độ ký cục bộ.",
  },
  onboarding: {
    skip: "Bỏ qua",
    next: "Tiếp",
    finish: "Chơi thôi",
    step1Title: "Kết nối ví",
    step1Body: "Cài Petra, Pontem hoặc Nightly rồi kết nối để chơi trên Aptos testnet.",
    step2Title: "Nhận faucet",
    step2Body: "Claim APT và shelbyUSD testnet miễn phí để mua gợi ý và nhận thưởng.",
    step3Title: "Chơi Level 1",
    step3Body: "Bắt đầu puzzle dễ. Giải xong để mở level tiếp và nhận shelbyUSD.",
  },
  settings: {
    title: "Cài đặt",
    description: "Âm thanh, giao diện và ngôn ngữ",
    mute: "Âm thanh",
    muted: "Tắt",
    soundOn: "Bật",
    theme: "Giao diện",
    dark: "Tối",
    light: "Sáng",
    language: "Ngôn ngữ",
  },
  badges: {
    title: "Huy hiệu",
    description: "NFT mốc (cục bộ đến khi deploy Move)",
    empty: "Giải level để nhận huy hiệu",
    earned: "Đã nhận",
  },
  referral: {
    title: "Giới thiệu",
    description: "Mời bạn — cả hai nhận credit shelbyUSD cục bộ",
    yourCode: "Mã mời của bạn",
    copy: "Sao chép",
    enterCode: "Nhập mã mời",
    apply: "Áp dụng",
    localBonus: "Credit thưởng cục bộ",
    applied: "Đã áp dụng referral",
  },
  seasonPass: {
    title: "Season Pass",
    description: "0.1 shelbyUSD / 30 ngày — gợi ý nửa giá + skin bàn",
    buy: "Mua pass",
    activeUntil: "Hết hạn",
    benefits: "Gợi ý nửa giá · Skin bàn mùa",
    localPurchase: "Pass cục bộ (deploy Move để mua on-chain)",
  },
  tokenomics: {
    title: "Chia phí gợi ý",
    treasury: "Kho thưởng",
    curator: "Curator",
    burn: "Đốt",
  },
  wallet: {
    noWallets:
      "Không thấy ví. Cài Petra, Pontem hoặc Nightly (extension Chrome), rồi tải lại trang.",
    getPetra: "Tải Petra →",
  },
};

const DICTS: Record<Locale, Dict> = { en, vi };

export function getDict(locale: Locale): Dict {
  return DICTS[locale] ?? en;
}
