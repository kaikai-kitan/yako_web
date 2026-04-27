<script>
    import { base } from '$app/paths';
</script>

<div class="pre-footer">
    <div class="pf-inner">

        <!-- サービス -->
        <div class="pf-col">
            <h3 class="pf-heading">サービス</h3>
            <ul class="pf-list">
                <li><a href="{base}/map" target="_blank" rel="noopener noreferrer">YATAKARI マップ</a></li>
                <li><a href="{base}/shop">公式オンラインストア</a></li>
                <li><a href="{base}/menu">メニュー</a></li>
            </ul>
        </div>

        <!-- 屋台出店者様へ -->
        <div class="pf-col pf-col-cta">
            <h3 class="pf-heading">屋台出店者様へ</h3>
            <ul class="pf-list">
                <li><a href="{base}/store-setup">公式ストア開設の手順</a></li>
                <li><a href="{base}/yatakari" target="_blank" rel="noopener noreferrer">YATAKARI 出退店管理</a></li>
            </ul>
            <a href="{base}/store-setup" class="cta-btn">
                公式ストア開設はこちら →
            </a>
        </div>

        <!-- 会社情報 -->
        <div class="pf-col">
            <h3 class="pf-heading">会社情報</h3>
            <ul class="pf-list">
                <li><a href="{base}/company">会社概要</a></li>
                <li><a href="{base}/terms">利用規約</a></li>
                <li><a href="{base}/tokusho">特定商取引法に基づく表記</a></li>
                <li>
                    <a href="https://www.instagram.com/delta_yako?igsh=MTYxZmJzZG5yZHZieA%3D%3D&utm_source=qr"
                        target="_blank" rel="noopener noreferrer" class="ig-link">
                        <svg class="ig-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                            <circle cx="12" cy="12" r="4"/>
                            <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
                        </svg>
                        Instagram
                    </a>
                </li>
            </ul>
        </div>

    </div>
</div>

<style>
    .pre-footer {
        background: #26201a;
        color: #e8e0d8;
        padding: 48px 24px 40px;
    }

    .pf-inner {
        max-width: 900px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 40px;
    }

    @media (max-width: 640px) {
        .pf-inner {
            grid-template-columns: 1fr;
            gap: 32px;
        }
    }

    .pf-heading {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #a09080;
        margin: 0 0 14px;
    }

    .pf-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .pf-list a {
        font-size: 0.88rem;
        color: #c8bfb5;
        text-decoration: none;
        transition: color 0.15s;
    }
    .pf-list a:hover { color: #fff; }

    /* CTAボタン */
    .cta-btn {
        display: inline-block;
        margin-top: 18px;
        padding: 10px 18px;
        background: #d56d04;
        color: #fff !important;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 700;
        text-decoration: none !important;
        transition: background 0.15s;
        white-space: nowrap;
    }
    .cta-btn:hover { background: #b85d03; }

    /* Instagramリンク */
    .ig-link {
        display: flex !important;
        align-items: center;
        gap: 6px;
    }
    .ig-icon {
        width: 16px;
        height: 16px;
        stroke: #e1306c;
        flex-shrink: 0;
    }
</style>
