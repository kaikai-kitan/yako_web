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
    
    if (splash) {  // スプラッシュ要素が存在する場合（トップページの場合）
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
});
