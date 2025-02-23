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
    
    // スプラッシュ画面をフェードアウトして非表示
    setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => {
            splash.style.display = 'none';
        }, 1000); // フェードアウトのアニメーション時間後に非表示
    }, 4000);

    // ハンバーガーメニューの制御
    const hamburger = document.querySelector('.hamburger');
    const nav = document.querySelector('.nav');
    
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
});
