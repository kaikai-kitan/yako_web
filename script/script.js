document.addEventListener("DOMContentLoaded", function () {
    const iconMenu = document.querySelector(".yatai_img");

    function handleScroll() {
        const rect = iconMenu.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // 要素が画面の下から 100px 以内に入ったら表示
        if (rect.top < windowHeight - 100) {
            iconMenu.classList.add("show");
        }
    }

    window.addEventListener("scroll", handleScroll);

    // 初期スクロール位置での確認
    handleScroll();
});

document.addEventListener("DOMContentLoaded", function () {
    const iconMenu = document.querySelector("main p");

    function handleScroll() {
        const rect = iconMenu.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // 要素が画面の下から 100px 以内に入ったら表示
        if (rect.top < windowHeight - 100) {
            iconMenu.classList.add("show");
        }
    }

    window.addEventListener("scroll", handleScroll);

    // 初期スクロール位置での確認
    handleScroll();
});

document.addEventListener('DOMContentLoaded', () => {
    const splash = document.querySelector('.splash');
    
    // URLパラメータをチェック
    const urlParams = new URLSearchParams(window.location.search);
    const noSplash = urlParams.get('nosplash');

    if (splash && !noSplash) {  // スプラッシュ要素が存在し、かつnosplashパラメータがない場合
        // スプラッシュ表示中はbodyにクラスを追加
        document.body.classList.add('splash-active');
        
        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.style.display = 'none';
                // スプラッシュ終了後にクラスを削除
                document.body.classList.remove('splash-active');
            }, 1000);
        }, 4000);
    } else if (splash) {
        // nosplashパラメータがある場合は即座に非表示
        splash.style.display = 'none';
    }

    // ハンバーガーメニューの制御（全ページ共通）
    const hamburger = document.querySelector('.hamburger');
    const nav = document.querySelector('.nav');
    
    if (hamburger && nav) {  // 要素の存在確認
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            nav.classList.toggle('active');
        });

        // メニューリンクをクリックしたらメニューを閉じる
        document.querySelectorAll('.nav a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                nav.classList.remove('active');
            });
        });
    }

    // 画像スライドショーの制御
    const images = document.querySelectorAll('.slideshow-img');
    let currentImageIndex = 0;
    
    // 最初の画像を表示
    if (images.length > 0) {
        images[0].classList.add('active');
    }

    // 4秒ごとに画像を切り替え
    function switchImage() {
        // 現在の画像を非表示
        images[currentImageIndex].classList.remove('active');
        
        // 次の画像のインデックスを計算
        currentImageIndex = (currentImageIndex + 1) % images.length;
        
        // 次の画像を表示
        images[currentImageIndex].classList.add('active');
    }

    // 4秒後から画像切り替えを開始
    setTimeout(() => {
        setInterval(switchImage, 4000);
    }, 4000);
});
