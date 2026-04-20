<script>
    import { base } from '$app/paths';
    import { page } from '$app/stores';
    import { session } from '$lib/auth.js';
    import { signOut } from '$lib/db.js';
    import { goto } from '$app/navigation';

    let isMenuOpen = $state(false);

    let currentPath = $derived($page.url.pathname);

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
    }

    function closeMenu() {
        isMenuOpen = false;
    }

    async function handleSignOut() {
        await signOut();
        closeMenu();
        goto(`${base}/`);
    }
</script>

<!-- 固定ヘッダーバー -->
<header class="site-header">
    <!-- ロゴ -->
    <a href="{base}/" class="logo-link" onclick={closeMenu}>
        <img src="{base}/images/icon.png" alt="微小夜行電灯" class="logo-img" />
        <span class="logo-text">微小夜行電灯</span>
    </a>

    <!-- プライマリナビ（常時表示） -->
    <nav class="primary-nav" aria-label="主要ナビゲーション">
        <a href="{base}/map" class="primary-nav-item" class:nav-active={currentPath.startsWith('/map')} onclick={closeMenu}>
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>YATAKARI</span>
        </a>
        <a href="{base}/shop" class="primary-nav-item" class:nav-active={currentPath.startsWith('/shop')} onclick={closeMenu}>
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span>オンラインストア</span>
        </a>

        <!-- デスクトップ用その他のリンク -->
        <a href="{base}/menu" class="desktop-nav-item" onclick={closeMenu}>メニュー</a>
        <a href="{base}/company" class="desktop-nav-item" onclick={closeMenu}>事業内容</a>
        {#if $session}
            <button class="desktop-nav-item desktop-auth-btn" onclick={handleSignOut}>ログアウト</button>
        {:else}
            <a href="{base}/auth" class="desktop-nav-item desktop-auth-link" onclick={closeMenu}>ログイン</a>
        {/if}
    </nav>

    <!-- ハンバーガーボタン -->
    <button
        class="hamburger"
        class:active={isMenuOpen}
        onclick={toggleMenu}
        aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
        aria-expanded={isMenuOpen}
    >
        <span></span>
        <span></span>
        <span></span>
    </button>
</header>

<!-- レイアウト用スペーサー（固定ヘッダーの高さ分） -->
<div class="header-spacer" aria-hidden="true"></div>

<!-- サイドメニュー（ハンバーガー展開時） -->
{#if isMenuOpen}
    <!-- 背景オーバーレイ -->
    <div
        class="menu-overlay"
        onclick={closeMenu}
        onkeydown={(e) => e.key === 'Escape' && closeMenu()}
        role="button"
        tabindex="-1"
        aria-label="メニューを閉じる"
    ></div>

    <!-- ドロワーメニュー -->
    <nav class="drawer-menu" aria-label="サイトメニュー">
        <div class="drawer-header">
            <img src="{base}/images/icon.png" alt="微小夜行電灯" class="drawer-logo" />
        </div>
        <ul>
            <li><a href="{base}/" onclick={closeMenu}>トップ</a></li>
            <li>
                <a href="{base}/map" class="drawer-item-with-icon" onclick={closeMenu}>
                    <svg class="drawer-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    YATAKARI
                </a>
            </li>
            <li>
                <a href="{base}/shop" class="drawer-item-with-icon" onclick={closeMenu}>
                    <svg class="drawer-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="9" cy="21" r="1"/>
                        <circle cx="20" cy="21" r="1"/>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    オンラインストア
                </a>
            </li>
            <li><a href="{base}/menu" onclick={closeMenu}>メニュー</a></li>
            <li><a href="{base}/company" onclick={closeMenu}>事業内容</a></li>
            <li>
                <a
                    href="https://www.instagram.com/delta_yako?igsh=MTYxZmJzZG5yZHZieA%3D%3D&utm_source=qr"
                    target="_blank"
                    rel="noopener noreferrer"
                    onclick={closeMenu}
                >Instagram</a>
            </li>
            <li><a href="{base}/terms" onclick={closeMenu}>利用規約</a></li>
            <li><a href="{base}/tokusho" onclick={closeMenu}>特定商取引法に基づく表記</a></li>
            <li class="drawer-auth">
                {#if $session}
                    <button class="drawer-auth-btn" onclick={handleSignOut}>ログアウト</button>
                {:else}
                    <a href="{base}/auth" class="drawer-auth-link" onclick={closeMenu}>ログイン / 新規登録</a>
                {/if}
            </li>
        </ul>
    </nav>
{/if}

<style>
    /* ========== 共通 ========== */
    .site-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        z-index: 200;
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.97);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid #ede8e0;
        padding: 0 16px;
        gap: 12px;
        box-sizing: border-box;
    }

    .header-spacer {
        height: 60px;
        flex-shrink: 0;
    }

    /* ロゴ */
    .logo-link {
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: #26201a;
        flex-shrink: 0;
    }
    .logo-img {
        width: 36px;
        height: 36px;
        object-fit: contain;
    }
    .logo-text {
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        white-space: nowrap;
        display: none; /* モバイルでは非表示 */
    }

    /* プライマリナビ */
    .primary-nav {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: auto;
        min-width: 0; /* 縮小可能にしてハンバーガーを押し出さない */
        overflow: hidden;
    }

    .primary-nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 6px 12px;
        text-decoration: none;
        color: #26201a;
        font-size: 0.7rem;
        border-radius: 8px;
        transition: background 0.15s;
        white-space: nowrap;
    }
    .primary-nav-item:hover {
        background: #f5f0ea;
    }
    .primary-nav-item.nav-active {
        color: #26201a;
        position: relative;
    }
    .primary-nav-item.nav-active::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 20%; right: 20%;
        height: 3px;
        background: #f97316;
        border-radius: 2px;
    }

    .nav-icon {
        width: 22px;
        height: 22px;
        stroke: #26201a;
    }

    /* デスクトップ専用リンク（モバイルでは非表示） */
    .desktop-nav-item {
        display: none;
        padding: 8px 12px;
        text-decoration: none;
        color: #26201a;
        font-size: 0.88rem;
        border-radius: 6px;
        white-space: nowrap;
        background: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s;
    }
    .desktop-nav-item:hover { background: #f5f0ea; }
    .desktop-auth-link {
        border: 1.5px solid #26201a;
        border-radius: 6px;
        padding: 6px 12px;
    }
    .desktop-auth-btn {
        border: 1.5px solid #26201a;
        border-radius: 6px;
        padding: 6px 12px;
    }

    /* ハンバーガーボタン */
    .hamburger {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 5px;
        width: 40px;
        height: 40px;
        flex-shrink: 0; /* 絶対に縮まない */
        cursor: pointer;
        background: none;
        border: none;
        border-radius: 8px;
        padding: 8px;
        margin-left: 4px;
    }
    .hamburger:hover { background: #f5f0ea; }

    .hamburger span {
        display: block;
        width: 20px;
        height: 2px;
        background: #26201a;
        border-radius: 2px;
        transition: transform 0.25s ease, opacity 0.25s ease;
        transform-origin: center;
    }
    .hamburger.active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .hamburger.active span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    .hamburger.active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    /* ========== オーバーレイ ========== */
    .menu-overlay {
        position: fixed;
        inset: 0;
        z-index: 198;
        background: rgba(0, 0, 0, 0.35);
    }

    /* ========== ドロワーメニュー ========== */
    .drawer-menu {
        position: fixed;
        top: 0;
        right: 0;
        width: min(280px, 80vw);
        height: 100dvh;
        background: #fff;
        z-index: 199;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    }

    .drawer-header {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 80px 20px 16px; /* 上部60px固定ヘッダー + 余白20px */
        border-bottom: 1px solid #ede8e0;
    }
    .drawer-logo {
        width: 56px;
        height: 56px;
        object-fit: contain;
    }

    .drawer-menu ul {
        list-style: none;
        margin: 0;
        padding: 8px 0;
        flex: 1;
    }
    .drawer-menu li {
        border-bottom: 1px solid #f5f0ea;
    }
    .drawer-menu a {
        display: block;
        padding: 16px 24px;
        text-decoration: none;
        color: #26201a;
        font-size: 0.95rem;
        transition: background 0.15s;
    }
    .drawer-menu a:hover { background: #faf8f5; }

    .drawer-item-with-icon {
        display: flex !important;
        align-items: center;
        gap: 10px;
    }
    .drawer-nav-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        stroke: #26201a;
    }

    .drawer-auth {
        margin-top: auto;
        border-bottom: none !important;
        padding: 16px 24px;
    }
    .drawer-auth-btn {
        width: 100%;
        padding: 12px;
        background: none;
        border: 1.5px solid #26201a;
        border-radius: 8px;
        color: #26201a;
        font-size: 0.95rem;
        font-family: inherit;
        cursor: pointer;
    }
    .drawer-auth-link {
        display: block;
        padding: 12px !important;
        border: 1.5px solid #26201a !important;
        border-radius: 8px;
        text-align: center;
    }

    /* ========== デスクトップ (769px〜) ========== */
    @media (min-width: 769px) {
        .site-header {
            padding: 0 32px;
            gap: 16px;
        }

        .logo-text { display: block; font-size: 1rem; }

        /* デスクトップではアイコン付き2項目 + テキストリンク群を横並び */
        .primary-nav { gap: 8px; }

        .primary-nav-item {
            flex-direction: row;
            gap: 6px;
            font-size: 0.85rem;
            padding: 8px 14px;
        }

        .desktop-nav-item { display: inline-flex; align-items: center; }

        /* デスクトップではハンバーガーを隠す */
        .hamburger { display: none; }
    }
</style>
