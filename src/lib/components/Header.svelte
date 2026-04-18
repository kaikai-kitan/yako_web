<script>
    import { base } from '$app/paths';
    import { session } from '$lib/auth.js';
    import { signOut } from '$lib/db.js';
    import { goto } from '$app/navigation';

    let isOpen = false;

    function toggleMenu() {
        isOpen = !isOpen;
    }

    async function handleSignOut() {
        await signOut();
        goto(`${base}/`);
        isOpen = false;
    }
</script>

<header>
    <div 
        class="hamburger" 
        class:active={isOpen} 
        on:click={toggleMenu} 
        on:keydown={(e) => e.key === 'Enter' && toggleMenu()}
        role="button" 
        tabindex="0"
    >
        <span></span>
        <span></span>
        <span></span>
    </div>

    <nav class:open={isOpen}>
        <ul>
            <li>
                <div class="navicon">
                    <a
                        href="https://www.instagram.com/delta_yako?igsh=MTYxZmJzZG5yZHZieA%3D%3D&utm_source=qr"
                        target="_blank"
                        rel="noopener noreferrer"
                        ><img
                            src="{base}/images/icon.png"
                            alt="微小夜行電灯のメニュー一覧用画像"
                            class="iconmenu"
                        /></a
                    >
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/" class="btn">微小夜行電灯</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/menu" class="btn">メニュー</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/map" class="btn">屋台貸し出し</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/shop" class="btn">ショップ</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/company" class="btn">事業内容</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    <a href="{base}/directory" class="btn">夜行人図鑑</a>
                </div>
            </li>
            <li>
                <div class="navbutton">
                    {#if $session}
                        <button class="btn auth-btn" on:click={handleSignOut}>ログアウト</button>
                    {:else}
                        <a href="{base}/auth" class="btn auth-link">ログイン / 登録</a>
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
        justify-content: space-around; /*アイテムの均等配置*/
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
    }

    .auth-link {
        border: 1.5px solid #26201a;
        border-radius: 6px;
    }

    .hamburger {
        display: none;
    }

    @media screen and (max-width: 768px) {
        /* ▼ ここから追加・修正 ▼ */
        
        /* スマホ画面ではデフォルトでナビゲーションを非表示にする */
        nav {
            display: none;
            position: absolute;
            top: 70px; /* ヘッダーの高さに合わせて調整してください */
            left: 0;
            width: 100%;
            background-color: rgba(255, 255, 255, 0.95); /* 背景色を設定して見やすく */
            z-index: 9999;
            padding-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        /* メニューが開いている（openクラスがついた）時は表示する */
        nav.open {
            display: block;
        }

        /* スマホ画面ではメニューを縦並びにする */
        nav ul {
            flex-direction: column;
        }

        nav li {
            margin: 10px 0;
        }

        .navbutton {
            text-align: center; /* スマホでは中央揃えの方が見栄えが良いことが多いです */
        }
        /* ▲ ここまで追加・修正 ▲ */

        /* ハンバーガーメニュー */
        .hamburger {
            display: block;
            position: fixed;
            top: 20px;
            right: 20px;
            width: 30px;
            height: 24px;
            z-index: 10000;
            cursor: pointer;
            background-color: rgba(255, 255, 255, 0.9);
            padding: 10px;
            border-radius: 5px;
        }

        .hamburger span {
            display: block;
            position: absolute;
            left: 10px;
            width: 30px;
            height: 2px;
            background-color: #26201a;
            transition: 0.3s ease-in-out;
        }

        .hamburger span:nth-child(1) {
            top: 10px;
        }

        .hamburger span:nth-child(2) {
            top: 21px;
        }

        .hamburger span:nth-child(3) {
            top: 32px;
        }

        /* ハンバーガーメニューがアクティブ時の調整 */
        .hamburger.active span:nth-child(1) {
            transform: translateY(11px) rotate(-45deg);
        }

        .hamburger.active span:nth-child(2) {
            opacity: 0;
        }

        .hamburger.active span:nth-child(3) {
            transform: translateY(-11px) rotate(45deg);
        }
    }
</style>
