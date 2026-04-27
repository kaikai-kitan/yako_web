<!-- 公式ストア開設ページ -->
<script>
    import { onMount } from 'svelte';
    import { base } from '$app/paths';
    import { goto } from '$app/navigation';
    import { supabase } from '$lib/supabase.js';

    let currentUser = $state(null);
    let isLoading = $state(true);
    let isSaving = $state(false);
    let saveMessage = $state('');
    let saveError = $state('');

    // フォームフィールド
    let storeName = $state('');
    let storeDescription = $state('');
    let category = $state('');
    let instagramUrl = $state('');
    let websiteUrl = $state('');
    let contactEmail = $state('');
    let isPublic = $state(false);

    const CATEGORIES = ['ラーメン・麺類', 'たこ焼き・粉もの', 'から揚げ・揚げ物', 'スイーツ・デザート', 'ドリンク・カフェ', 'アジア料理', 'その他'];

    onMount(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            goto(`${base}/auth?redirectTo=${encodeURIComponent(`${base}/store-setup`)}`);
            return;
        }
        currentUser = session.user;

        // 既存データ読み込み
        const { data } = await supabase
            .from('vendor_stores')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (data) {
            storeName       = data.store_name ?? '';
            storeDescription = data.description ?? '';
            category        = data.category ?? '';
            instagramUrl    = data.instagram_url ?? '';
            websiteUrl      = data.website_url ?? '';
            contactEmail    = data.contact_email ?? '';
            isPublic        = data.is_public ?? false;
        }
        isLoading = false;
    });

    async function handleSave() {
        if (!storeName.trim()) { saveError = '店舗名を入力してください'; return; }
        isSaving = true;
        saveError = '';
        saveMessage = '';

        const payload = {
            user_id:       currentUser.id,
            store_name:    storeName.trim(),
            description:   storeDescription.trim(),
            category:      category,
            instagram_url: instagramUrl.trim(),
            website_url:   websiteUrl.trim(),
            contact_email: contactEmail.trim(),
            is_public:     isPublic,
            updated_at:    new Date().toISOString(),
        };

        const { error } = await supabase
            .from('vendor_stores')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) {
            saveError = '保存に失敗しました: ' + error.message;
        } else {
            saveMessage = '保存しました！';
        }
        isSaving = false;
    }
</script>

<svelte:head>
    <title>公式ストア開設 | 微小夜行電灯</title>
</svelte:head>

<!-- ヒーロー -->
<div class="hero">
    <div class="hero-overlay"></div>
    <div class="hero-content">
        <span class="hero-label">For Vendors</span>
        <h1 class="hero-title">公式ストア開設</h1>
        <p class="hero-sub">YATAKARI に登録して、あなたの屋台を多くのお客様へ届けよう</p>
    </div>
</div>

<!-- ステップ説明 -->
<section class="steps-section">
    <div class="steps-inner">
        <h2 class="steps-title">開設までの流れ</h2>
        <div class="steps-grid">
            <div class="step">
                <span class="step-num">01</span>
                <span class="step-icon">📝</span>
                <h3 class="step-name">会員登録</h3>
                <p class="step-desc">メールアドレスでアカウントを作成します</p>
            </div>
            <div class="step">
                <span class="step-num">02</span>
                <span class="step-icon">🏮</span>
                <h3 class="step-name">店舗情報入力</h3>
                <p class="step-desc">店舗名・カテゴリ・説明文を設定します</p>
            </div>
            <div class="step">
                <span class="step-num">03</span>
                <span class="step-icon">🗺️</span>
                <h3 class="step-name">スペース予約</h3>
                <p class="step-desc">YATAKARIマップから出店日時・場所を予約</p>
            </div>
            <div class="step">
                <span class="step-num">04</span>
                <span class="step-icon">🛍️</span>
                <h3 class="step-name">ストア公開</h3>
                <p class="step-desc">オンラインストアで商品を販売開始</p>
            </div>
        </div>
    </div>
</section>

<!-- 設定フォーム -->
<section class="form-section">
    <div class="form-inner">
        <h2 class="form-title">店舗情報を設定する</h2>

        {#if isLoading}
            <div class="loading">読み込み中…</div>
        {:else if !currentUser}
            <div class="auth-prompt">
                <p>設定するにはログインが必要です</p>
                <a href="{base}/auth?redirectTo={encodeURIComponent(`${base}/store-setup`)}" class="login-btn">
                    ログイン / 新規登録
                </a>
            </div>
        {:else}
            <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="store-form">

                {#if saveMessage}
                    <p class="msg-success">{saveMessage}</p>
                {/if}
                {#if saveError}
                    <p class="msg-error">{saveError}</p>
                {/if}

                <div class="field">
                    <label class="label" for="storeName">店舗名 <span class="req">*</span></label>
                    <input id="storeName" type="text" class="input" bind:value={storeName}
                        placeholder="例：鴨川屋台 〇〇" maxlength="50" />
                </div>

                <div class="field">
                    <label class="label" for="category">カテゴリ</label>
                    <select id="category" class="input" bind:value={category}>
                        <option value="">選択してください</option>
                        {#each CATEGORIES as cat}
                            <option value={cat}>{cat}</option>
                        {/each}
                    </select>
                </div>

                <div class="field">
                    <label class="label" for="storeDescription">店舗説明</label>
                    <textarea id="storeDescription" class="input textarea"
                        bind:value={storeDescription}
                        placeholder="お店のこだわりや特徴を書いてください"
                        rows="4" maxlength="300"></textarea>
                    <span class="char-count">{storeDescription.length}/300</span>
                </div>

                <div class="field">
                    <label class="label" for="contactEmail">連絡先メール</label>
                    <input id="contactEmail" type="email" class="input" bind:value={contactEmail}
                        placeholder="example@mail.com" />
                </div>

                <div class="field">
                    <label class="label" for="instagramUrl">Instagram URL</label>
                    <input id="instagramUrl" type="url" class="input" bind:value={instagramUrl}
                        placeholder="https://www.instagram.com/..." />
                </div>

                <div class="field">
                    <label class="label" for="websiteUrl">ウェブサイト URL</label>
                    <input id="websiteUrl" type="url" class="input" bind:value={websiteUrl}
                        placeholder="https://..." />
                </div>

                <div class="field field-row">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-input" bind:checked={isPublic} />
                        <span class="toggle-track">
                            <span class="toggle-thumb"></span>
                        </span>
                        <span class="toggle-text">
                            ストアを公開する
                            <span class="toggle-sub">オンにするとマップ・ストアに店舗情報が表示されます</span>
                        </span>
                    </label>
                </div>

                <button type="submit" class="save-btn" disabled={isSaving}>
                    {isSaving ? '保存中…' : '設定を保存する'}
                </button>

                <div class="next-steps">
                    <p class="next-title">次のステップ</p>
                    <a href="{base}/map" target="_blank" rel="noopener noreferrer" class="next-link">
                        🗺️ YATAKARIマップでスペースを予約する →
                    </a>
                    <a href="{base}/shop" class="next-link">
                        🛍️ 公式オンラインストアを確認する →
                    </a>
                </div>
            </form>
        {/if}
    </div>
</section>

<style>
    /* ヒーロー */
    .hero {
        position: relative;
        height: 280px;
        background-image: url('/images/shop/yatai.jpg');
        background-size: cover;
        background-position: center;
        display: flex; align-items: center; justify-content: center;
    }
    .hero-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); }
    .hero-content {
        position: relative; z-index: 1;
        text-align: center; color: #fff; padding: 0 20px;
    }
    .hero-label {
        font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase;
        color: #e8c97a; font-weight: 700;
    }
    .hero-title {
        font-size: clamp(1.6rem, 5vw, 2.4rem); font-weight: 800;
        letter-spacing: 0.08em; margin: 8px 0 10px;
    }
    .hero-sub { font-size: 0.9rem; opacity: 0.85; margin: 0; }

    /* ステップ */
    .steps-section { background: #faf8f5; padding: 48px 20px; }
    .steps-inner { max-width: 800px; margin: 0 auto; }
    .steps-title {
        text-align: center; font-size: 1.2rem; font-weight: 700;
        color: #26201a; margin: 0 0 32px;
    }
    .steps-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
    }
    @media (max-width: 640px) {
        .steps-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .step {
        background: white; border-radius: 16px; padding: 20px 14px;
        text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        display: flex; flex-direction: column; align-items: center; gap: 6px;
    }
    .step-num {
        font-size: 0.68rem; font-weight: 800; color: #d56d04;
        letter-spacing: 0.08em;
    }
    .step-icon { font-size: 1.8rem; }
    .step-name { font-size: 0.88rem; font-weight: 700; color: #26201a; margin: 0; }
    .step-desc { font-size: 0.72rem; color: #7a6f67; margin: 0; line-height: 1.4; }

    /* フォーム */
    .form-section { padding: 48px 20px 64px; background: #fff; }
    .form-inner { max-width: 560px; margin: 0 auto; }
    .form-title { font-size: 1.1rem; font-weight: 700; color: #26201a; margin: 0 0 28px; }

    .loading { text-align: center; color: #9e9289; padding: 40px; }

    .auth-prompt { text-align: center; padding: 40px 0; }
    .auth-prompt p { color: #7a6f67; margin-bottom: 16px; }
    .login-btn {
        display: inline-block; padding: 12px 28px;
        background: #26201a; color: white; border-radius: 10px;
        text-decoration: none; font-weight: 700; font-size: 0.95rem;
    }

    .store-form { display: flex; flex-direction: column; gap: 20px; }

    .msg-success {
        background: #dcfce7; color: #166534;
        border-radius: 8px; padding: 10px 14px; font-size: 0.88rem;
    }
    .msg-error {
        background: #fee2e2; color: #dc2626;
        border-radius: 8px; padding: 10px 14px; font-size: 0.88rem;
    }

    .field { display: flex; flex-direction: column; gap: 6px; }
    .label { font-size: 0.85rem; font-weight: 600; color: #26201a; }
    .req { color: #d56d04; }
    .input {
        padding: 10px 14px; border: 1.5px solid #e8e0d8; border-radius: 8px;
        font-size: 0.95rem; font-family: inherit; color: #26201a;
        background: #faf8f5; transition: border-color 0.15s; width: 100%; box-sizing: border-box;
    }
    .input:focus { outline: none; border-color: #d56d04; background: #fff; }
    .textarea { resize: vertical; }
    .char-count { font-size: 0.72rem; color: #9e9289; text-align: right; }

    /* トグル */
    .field-row { flex-direction: row; align-items: flex-start; }
    .toggle-label { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; }
    .toggle-input { display: none; }
    .toggle-track {
        width: 44px; height: 26px; background: #e8e0d8; border-radius: 100px;
        flex-shrink: 0; position: relative; transition: background 0.2s; margin-top: 2px;
    }
    .toggle-input:checked + .toggle-track { background: #d56d04; }
    .toggle-thumb {
        position: absolute; top: 3px; left: 3px;
        width: 20px; height: 20px; background: white; border-radius: 50%;
        transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    }
    .toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(18px); }
    .toggle-text { display: flex; flex-direction: column; gap: 2px; }
    .toggle-sub { font-size: 0.72rem; color: #9e9289; font-weight: 400; }

    .save-btn {
        padding: 14px; background: #26201a; color: white;
        border: none; border-radius: 10px; font-size: 1rem;
        font-weight: 700; font-family: inherit; cursor: pointer;
        transition: background 0.15s;
    }
    .save-btn:hover { background: #3a2e26; }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .next-steps {
        border-top: 1px solid #ede8e0; padding-top: 20px;
        display: flex; flex-direction: column; gap: 10px;
    }
    .next-title { font-size: 0.8rem; font-weight: 700; color: #9e9289; margin: 0; }
    .next-link {
        font-size: 0.88rem; color: #26201a; text-decoration: none;
        padding: 10px 14px; border: 1px solid #e8e0d8; border-radius: 8px;
        transition: background 0.15s;
    }
    .next-link:hover { background: #faf8f5; }
</style>
