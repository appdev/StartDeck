package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func testDailyEnglishCache(t *testing.T) *WidgetCache {
	t.Helper()
	return &WidgetCache{
		filePath:   filepath.Join(t.TempDir(), "widget_cache.json"),
		syncSave:   true,
		cache:      make(map[string]map[string]*WidgetCacheItem),
		refreshing: make(map[string]bool),
	}
}

func TestItabDailyEnglishFetchNormalizesAndCaches(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("Referer") != "" {
			t.Fatalf("caller credentials were forwarded: %#v", r.Header)
		}
		if r.Header.Get("Accept") != "application/json" {
			t.Fatalf("unexpected accept header %q", r.Header.Get("Accept"))
		}
		if r.URL.Query().Get("lang") != "cn" {
			t.Fatalf("expected lang=cn, got %q", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": {
				"content": "Light stretches longer, painting walls gold.",
				"note": "日光拉得更长，把墙壁染成金色。",
				"picture2": "https://staticedu-wps-cache.iciba.com/image/fa0ba1a3b8cc0bc45195b87a9e7dc82f.png",
				"tts": "https://staticedu-wps-cache.iciba.com/audio/daily.mp3",
				"dateline": "20260522"
			}
		}`))
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testDailyEnglishCache(t)
	router.GET("/api/itab/today-english", func(c *gin.Context) {
		serveItabDailyEnglishWithOptions(c, itabDailyEnglishHandlerOptions{
			client:      upstream.Client(),
			cache:       cache,
			upstreamURL: upstream.URL,
		})
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/itab/today-english", nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d expected 200, got %d: %s", i+1, w.Code, w.Body.String())
		}
		var payload struct {
			Success bool                 `json:"success"`
			Data    ItabDailyEnglishData `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if !payload.Success || payload.Data.SourceStatus != "ok" {
			t.Fatalf("unexpected payload status %#v", payload)
		}
		if payload.Data.Sentence != "Light stretches longer, painting walls gold." ||
			payload.Data.Translation != "日光拉得更长，把墙壁染成金色。" ||
			payload.Data.Dateline != "2026-05-22" {
			t.Fatalf("unexpected normalized data %#v", payload.Data)
		}
		if payload.Data.ImageURL != "/api/itab/today-english/media/image" ||
			payload.Data.AudioURL != "/api/itab/today-english/media/audio" {
			t.Fatalf("expected media urls to use backend proxy, got image=%q audio=%q", payload.Data.ImageURL, payload.Data.AudioURL)
		}
	}
	if requestCount != 1 {
		t.Fatalf("expected one upstream request due to fresh cache, got %d", requestCount)
	}
}

func TestItabDailyEnglishMediaEndpointStreamsInlineMedia(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("Referer") != "" {
			t.Fatalf("caller credentials were forwarded: %#v", r.Header)
		}
		if r.Method != http.MethodGet {
			t.Fatalf("expected GET upstream, got %s", r.Method)
		}
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Content-Disposition", "attachment")
		_, _ = w.Write([]byte("png"))
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testDailyEnglishCache(t)
	_ = cache.Set(widgetCacheKindItabDailyEnglish, itabDailyEnglishCacheKey, ItabDailyEnglishData{
		ImageURL: upstream.URL + "/image.png",
		AudioURL: upstream.URL + "/audio.mp3",
	}, time.Hour, "ok")
	router.GET("/api/itab/today-english/media/:kind", func(c *gin.Context) {
		serveItabDailyEnglishMediaWithOptions(c, itabDailyEnglishHandlerOptions{
			client:              upstream.Client(),
			cache:               cache,
			allowUnsafeMediaURL: true,
		})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/itab/today-english/media/image", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if w.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("unexpected content type %q", w.Header().Get("Content-Type"))
	}
	if w.Header().Get("Content-Disposition") != "" {
		t.Fatalf("content disposition should not be forwarded: %q", w.Header().Get("Content-Disposition"))
	}
	if w.Body.String() != "png" {
		t.Fatalf("unexpected body %q", w.Body.String())
	}
}

func TestItabDailyEnglishRejectsUnsafeMediaURLs(t *testing.T) {
	data, err := normalizeItabDailyEnglish(itabDailyEnglishUpstreamResponse{
		Content:  "安全过滤测试。",
		Note:     "Unsafe media URL test.",
		Picture2: "https://evil.example/a.png",
		Picture:  "http://127.0.0.1/a.png",
		TTS:      "https://evil.example/a.mp3",
		Dateline: "20260522",
	})
	if err != nil {
		t.Fatal(err)
	}
	if data.ImageURL != itabDailyEnglishFallbackImg {
		t.Fatalf("expected fallback image, got %q", data.ImageURL)
	}
	if data.AudioURL != "" {
		t.Fatalf("expected unsafe audio url to be stripped, got %q", data.AudioURL)
	}
}
