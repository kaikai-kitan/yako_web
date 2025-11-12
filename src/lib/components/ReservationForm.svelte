<!-- 予約フォーム -->
<script>
</script>

<div class="reservation-form-container">
	<h2 class="reservation-title">屋台貸し出しのご予約はこちら</h2>
	<p class="reservation-description">
		以下のカレンダーで空き状況をご確認の上、フォームよりご予約ください。
	</p>
	<div class="reservation-container">
		<div class="calendar-embed">
			<h3 class="title-for-embed">予約状況カレンダー</h3>
			<iframe
				title="予約状況カレンダー"
				src="https://calendar.google.com/calendar/embed?src=cfed507b8bd3c50b9beb4a6f84023b9b3331c85252e96c95b0d6812102cf80b7%40group.calendar.google.com&ctz=Asia%2FTokyo"
				style="border: 0"
				width="100%"
				height="600"
				frameborder="0"
				scrolling="no"
			></iframe>
		</div>
		<div class="form-embed">
			<h3 class="title-for-embed">予約フォーム</h3>
			<iframe
				title="屋台予約フォーム"
				src="https://docs.google.com/forms/d/e/1FAIpQLSdcQyz_HwlTNo67d72XjLdgDFU4SO1vgGPBdW0A4F2_XaC48A/viewform?embedded=true"
				width="100%"
				height="600"
				frameborder="0"
				marginheight="0"
				marginwidth="0">読み込んでいます…</iframe
			>
		</div>
	</div>
</div>

<style>

	.reservation-form-container {
    max-width: 1300px;
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
	}

  .reservation-title {
    text-align: center;
    margin-bottom: 0.5rem;
  }

  .reservation-description {
    text-align: center;
    margin-bottom: 2rem;
  }

  .reservation-container {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 20px;
    width: 100%;
    margin-bottom: 2rem;
  }

  .calendar-embed {
    flex: 1;
    min-width: 320px;
  }

  .form-embed {
    flex: 1;
    min-width: 320px;
  }

  .title-for-embed {
    margin-bottom: 1rem;
    text-align: center;
  }
</style>
