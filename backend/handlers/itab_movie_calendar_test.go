package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func testMovieCalendarCache(t *testing.T) *WidgetCache {
	t.Helper()
	return &WidgetCache{
		filePath:   filepath.Join(t.TempDir(), "widget_cache.json"),
		syncSave:   true,
		cache:      make(map[string]map[string]*WidgetCacheItem),
		refreshing: make(map[string]bool),
	}
}

func TestItabMovieCalendarFetchNormalizesSourcePayload(t *testing.T) {
	var requestedURL string
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestedURL = r.URL.String()
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("Referer") != "" {
			t.Fatalf("caller credentials were forwarded: %#v", r.Header)
		}
		if r.Header.Get("Accept") != "application/json" {
			t.Fatalf("unexpected accept header %q", r.Header.Get("Accept"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": {
				"date": "20260522",
				"mov_area": "美国 英国",
				"mov_director": "拉里·查尔斯",
				"mov_intro": "电影用讽刺癫狂的手段展现一场文化之旅。",
				"mov_link": "https://movie.douban.com/subject/1870044/",
				"mov_pic": "https://files.codelife.cc/itab/movieCalendar/c-202303231870044.webp?x-oss-process=image/resize,limit_0,m_fill,w_400",
				"poster_url": "https://files.codelife.cc/itab/movieCalendar/p-202303231870044.webp",
				"mov_rating": "7.4",
				"mov_text": "美国以其幽默感闻名于世。",
				"mov_title": "波拉特",
				"mov_type": ["喜剧", "喜剧"],
				"mov_year": "2006",
				"bgColor": "4c4c3f",
				"color": "f9f9f4"
			},
			"msg": "加载成功"
		}`))
	}))
	defer upstream.Close()

	data, err := fetchItabMovieCalendar(context.Background(), upstream.Client(), upstream.URL)
	if err != nil {
		t.Fatal(err)
	}
	if requestedURL != "/?version=v2" {
		t.Fatalf("expected version query to be injected, got %q", requestedURL)
	}
	if data.Date != "2026-05-22" || data.Day != "22" || data.MonthLabel != "5月" || data.Weekday != "周五" {
		t.Fatalf("unexpected normalized date fields: %#v", data)
	}
	if data.MovieTitle != "波拉特" || data.Rating != "7.4" || data.Quote != "美国以其幽默感闻名于世。" {
		t.Fatalf("unexpected movie text fields: %#v", data)
	}
	if data.SourceURL != "https://movie.douban.com/subject/1870044/" {
		t.Fatalf("unexpected source url %q", data.SourceURL)
	}
	if len(data.Genres) != 1 || data.Genres[0] != "喜剧" {
		t.Fatalf("unexpected genres %#v", data.Genres)
	}
}

func TestItabMovieCalendarHandlerUsesFreshCache(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": {
				"date": "20260522",
				"mov_link": "https://movie.douban.com/subject/1870044/",
				"mov_pic": "https://files.codelife.cc/itab/movieCalendar/c.webp",
				"poster_url": "https://files.codelife.cc/itab/movieCalendar/p.webp",
				"mov_rating": "7.4",
				"mov_text": "缓存命中测试。",
				"mov_title": "波拉特",
				"mov_type": ["喜剧"],
				"bgColor": "4c4c3f",
				"color": "f9f9f4"
			}
		}`))
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testMovieCalendarCache(t)
	router.GET("/api/itab/movie-calendar", func(c *gin.Context) {
		serveItabMovieCalendarWithOptions(c, itabMovieCalendarHandlerOptions{
			client:      upstream.Client(),
			cache:       cache,
			upstreamURL: upstream.URL,
		})
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/itab/movie-calendar", nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d expected 200, got %d: %s", i+1, w.Code, w.Body.String())
		}
		var payload struct {
			Success bool                  `json:"success"`
			Data    ItabMovieCalendarData `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if !payload.Success || payload.Data.MovieTitle != "波拉特" || payload.Data.SourceStatus != "ok" {
			t.Fatalf("unexpected payload %#v", payload)
		}
		if payload.Data.PosterURL != "/api/itab/movie-calendar/image/poster" || payload.Data.CoverURL != "/api/itab/movie-calendar/image/cover" {
			t.Fatalf("expected image urls to use backend proxy, got poster=%q cover=%q", payload.Data.PosterURL, payload.Data.CoverURL)
		}
	}
	if requestCount != 1 {
		t.Fatalf("expected one upstream request due to fresh cache, got %d", requestCount)
	}
}

func TestItabMovieCalendarHandlerRefreshesPreviousDayCacheBeforeResponding(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": {
				"date": "20260523",
				"mov_link": "https://movie.douban.com/subject/4712730/",
				"mov_pic": "https://files.codelife.cc/itab/movieCalendar/c-202303234712730.webp",
				"poster_url": "https://files.codelife.cc/itab/movieCalendar/p-202303234712730.webp",
				"mov_rating": "7.4",
				"mov_text": "你不需要成为任何人，只需做你自己。",
				"mov_title": "雌雄莫辨",
				"mov_type": ["剧情", "同性"],
				"mov_year": "2011",
				"mov_area": "英国 美国 爱尔兰",
				"bgColor": "3a444c",
				"color": "f4f7f9"
			}
		}`))
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testMovieCalendarCache(t)
	cache.cache[widgetCacheKindItabMovieCalendar] = map[string]*WidgetCacheItem{
		itabMovieCalendarCacheKey: {
			Data: ItabMovieCalendarData{
				Date:       "2026-05-22",
				Day:        "22",
				MonthLabel: "5月",
				Weekday:    "周五",
				MovieTitle: "波拉特",
				Rating:     "7.4",
				Quote:      "旧缓存不应跨天首屏返回。",
			},
			UpdatedAt:    time.Date(2026, 5, 22, 23, 55, 0, 0, time.FixedZone("CST", 8*60*60)).UnixMilli(),
			TTL:          int64(time.Hour.Seconds()),
			SourceStatus: "ok",
		},
	}
	router.GET("/api/itab/movie-calendar", func(c *gin.Context) {
		serveItabMovieCalendarWithOptions(c, itabMovieCalendarHandlerOptions{
			client:      upstream.Client(),
			cache:       cache,
			upstreamURL: upstream.URL,
			now: func() time.Time {
				return time.Date(2026, 5, 23, 9, 0, 0, 0, time.FixedZone("CST", 8*60*60))
			},
		})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/itab/movie-calendar", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var payload struct {
		Success bool                  `json:"success"`
		Data    ItabMovieCalendarData `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if !payload.Success || payload.Data.Date != "2026-05-23" || payload.Data.MovieTitle != "雌雄莫辨" || payload.Data.SourceStatus != "ok" {
		t.Fatalf("expected current-day movie response, got %#v", payload)
	}
	if requestCount != 1 {
		t.Fatalf("expected one synchronous upstream refresh, got %d", requestCount)
	}
}

func TestItabMovieCalendarImageEndpointStreamsInlineImage(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("Referer") != "" {
			t.Fatalf("caller credentials were forwarded: %#v", r.Header)
		}
		w.Header().Set("Content-Type", "image/webp")
		w.Header().Set("Content-Disposition", "attachment")
		_, _ = w.Write([]byte("webp"))
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testMovieCalendarCache(t)
	_ = cache.Set(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, ItabMovieCalendarData{
		PosterURL: upstream.URL + "/poster.webp",
		CoverURL:  upstream.URL + "/cover.webp",
	}, time.Hour, "ok")
	router.GET("/api/itab/movie-calendar/image/:kind", func(c *gin.Context) {
		serveItabMovieCalendarImageWithOptions(c, itabMovieCalendarHandlerOptions{
			client:              upstream.Client(),
			cache:               cache,
			allowUnsafeImageURL: true,
		})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/itab/movie-calendar/image/poster", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if w.Header().Get("Content-Type") != "image/webp" {
		t.Fatalf("unexpected content type %q", w.Header().Get("Content-Type"))
	}
	if w.Header().Get("Content-Disposition") != "" {
		t.Fatalf("content disposition should not be forwarded: %q", w.Header().Get("Content-Disposition"))
	}
	if w.Body.String() != "webp" {
		t.Fatalf("unexpected body %q", w.Body.String())
	}
}

func TestItabMovieCalendarRejectsUnexpectedMediaHosts(t *testing.T) {
	data, err := normalizeItabMovieCalendar(itabMovieCalendarUpstreamData{
		Date:      "20260522",
		Title:     "波拉特",
		CoverURL:  "http://127.0.0.1/cover.webp",
		PosterURL: "https://evil.example/poster.webp",
		Link:      "https://example.com/subject/1870044/",
		Quote:     "安全过滤测试。",
		Genres:    []string{"喜剧"},
		BgColor:   "#BADHEX",
		TextColor: "F9F9F4",
	})
	if err != nil {
		t.Fatal(err)
	}
	if data.CoverURL != "" || data.PosterURL != "" || data.SourceURL != "" {
		t.Fatalf("unexpected unsafe urls: %#v", data)
	}
	if data.BgColor != "4c4c3f" || data.TextColor != "f9f9f4" {
		t.Fatalf("unexpected colors bg=%q text=%q", data.BgColor, data.TextColor)
	}
	if strings.TrimSpace(data.Quote) == "" {
		t.Fatal("expected quote fallback to remain populated")
	}
}
