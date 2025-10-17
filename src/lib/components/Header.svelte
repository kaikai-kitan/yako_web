<script>
	import { base } from '$app/paths';
</script>

<header>
	<div class="hamburger">
		<span></span>
		<span></span>
		<span></span>
	</div>
	<nav>
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
					<a href="{base}/company" class="btn">事業内容</a>
				</div>
			</li>
			<li>
				<div class="navbutton">
					<a href="{base}/book" class="btn">夜行人図鑑</a>
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

	.hamburger {
		display: none;
	}

	@media screen and (max-width: 768px) {
		/* ハンバーガーメニュー */
		.hamburger {
			display: block;
			position: fixed;
			top: 20px;
			right: 20px;
			width: 30px; /* ハンバーガーアイコンの幅 */
			height: 24px; /* ハンバーガーアイコンの高さ */
			z-index: 10000;
			cursor: pointer;
			background-color: rgba(255, 255, 255, 0.9);
			padding: 10px;
			border-radius: 5px;
		}

		.hamburger span {
			display: block;
			position: absolute;
			left: 10px; /* 左側のパディングと同じ値 */
			width: 30px; /* 線の長さ */
			height: 2px;
			background-color: #26201a;
			transition: 0.3s ease-in-out;
		}

		.hamburger span:nth-child(1) {
			top: 10px; /* 上部のパディングと同じ値 */
		}

		.hamburger span:nth-child(2) {
			top: 21px; /* 中央の線の位置 */
		}

		.hamburger span:nth-child(3) {
			top: 32px; /* 下部の線の位置 */
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
