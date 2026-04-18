<script>
    import { base } from '$app/paths';
    import { session } from '$lib/auth.js';
    import { signOut } from '$lib/db.js';
    import { goto } from '$app/navigation';

    let isMenuOpen = $state(false);

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

<!-- 背景オーバーレイ（メニュー外クリックで閉じる） -->
{#if isMenuOpen}
    <div
        class="menu-overlay"
        onclick={closeMenu}
        onkeydown={(e) => e.key === 'Escape' && closeMenu()}
        role="button"
        tabindex="-1"
        aria-label="メニューを閉じる"
    ></div>
{/if}

<header>
    <button
        class="hamburger"
        class:active={isMenuOpen}
        onclick={toggleMenu}
        aria-label="メニュー"
        aria-expanded={isMenuOpen}
    >
        <span></span>
        <span></span>
        <span></span>
    </button>

    <nav class:open={isMenuOpen}>
        <ul>
            <li>
                <div class="navicon">
                    <a
                        href="https://www.instagram.com/delta_yako?igsh=MTYxZmJzZG5yZHZieA%3D%3D&utm_source=qr"
                        target="_blank"
                        rel="noopener noreferrer"
                        onclick={closeMenu}
                    >
                        <img
                            src="{base}/images/icon.png"
                            alt="微小夜行電灯のメニュー一覧用画像"
                            class="iconmenu"
                        />
                    </a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/" class="btn" onclick={closeMenu}>微小夜行電灯</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/menu" class="btn" onclick={closeMenu}>メニュー</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/map" class="btn" onclick={closeMenu}>屋台貸し出し</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/shop" class="btn" onclick={closeMenu}>ショップ</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/company" class="btn" onclick={closeMenu}>事業内容</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/directory" class="btn" onclick={closeMenu}>夜行人図鑑</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    {#if $session}
                        <button class="btn auth-btn" onclick={handleSignOut}>ログアウト</button>
                    {:else}
                        <a href="{base}/auth" class="btn auth-link" onclick={closeMenu}>ログイン / 登録</a>
                    {/if}
                </div>
            </li>
        </ul>
    </nav>
</header>

<style>
    header {
        margin: 20px;
    }

    nav {
        width: 100%;
        padding: auto;
    }

    nav ul {
        display: flex;
        justify-content: space-around;
        align-items: center;
        list-style-type: none;
        padding: 0;
        margin: 0;
    }

    nav li {
        flex: 1;
        margin: 0 20px;
        text-align: center;
    }

    .iconmenu {
        padding-top: 5px;
        max-width: 70px;
        height: auto;
    }

    .navbutton {
        text-align: left;
    }

    .btn {
        display: block;
        padding: 10px;
        text-decoration: none;
        color: #26201a;
    }

    .auth-btn {
        background: none;
        border: 1.5px solid #26201a;
        border-radius: 6px;
        cursor: pointer;
        font-size: inherit;
        font-family: inherit;
        padding: 10px;
        color: #26201a;
    }

    .auth-link {
        border: 1.5px solid #26201a;
        border-radius: 6px;
    }

    .hamburger {
        display: none;
    }

    .menu-overlay {
        display: none;
    }

    @media screen and (max-width: 768px) {
        /* オーバーレイ */
        .menu-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 998;
            background: transparent;
        }

        /* ナビゲーション（固定、スクロール影響なし） */
        nav {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100dvh;
            background-color: rgba(255, 255, 255, 0.97);
            z-index: 999;
            overflow-y: auto;
            padding: 80px 0 40px;
            box-sizing: border-box;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        nav.open {
            display: block;
        }

        nav ul {
            flex-direction: column;
            align-items: stretch;
        }

        nav li {
            margin: 0;
            border-bottom: 1px solid #f0ebe4;
        }

        .navbutton {
            text-align: center;
        }

        .btn {
            padding: 16px 24px;
            font-size: 1rem;
        }

        .navicon {
            display: flex;
            justify-content: center;
            padding: 12px 0;
        }

        /* ハンバーガーボタン（固定表示） */
        .hamburger {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 5px;
            position: fixed;
            top: 16px;
            right: 16px;
            width: 44px;
            height: 44px;
            z-index: 1000;
            cursor: pointer;
            background-color: rgba(255, 255, 255, 0.95);
            border: none;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        .hamburger span {
            display: block;
            width: 22px;
            height: 2px;
            background-color: #26201a;
            transition: transform 0.25s ease, opacity 0.25s ease;
            transform-origin: center;
        }

        /* ×アイコン（アクティブ時） */
        .hamburger.active span:nth-child(1) {
            transform: translateY(7px) rotate(45deg);
        }

        .hamburger.active span:nth-child(2) {
            opacity: 0;
            transform: scaleX(0);
        }

        .hamburger.active span:nth-child(3) {
            transform: translateY(-7px) rotate(-45deg);
        }
    }
</style>
