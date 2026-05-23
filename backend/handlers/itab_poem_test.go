package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func testItabPoemCache(t *testing.T) *WidgetCache {
	t.Helper()
	cachePath := filepath.Join(
		os.TempDir(),
		fmt.Sprintf(
			"startdeck-itab-poem-cache-%s-%d.json",
			strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()),
			time.Now().UnixNano(),
		),
	)
	t.Cleanup(func() {
		time.Sleep(50 * time.Millisecond)
		_ = os.Remove(cachePath)
		_ = os.Remove(cachePath + ".tmp")
	})
	return &WidgetCache{
		filePath:   cachePath,
		syncSave:   true,
		cache:      make(map[string]map[string]*WidgetCacheItem),
		refreshing: make(map[string]bool),
	}
}

func TestItabPoemFetchesNormalizesAndCaches(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("Referer") != "" {
			t.Fatalf("caller credentials were forwarded: %#v", r.Header)
		}
		if r.URL.Path != "/one.json" {
			t.Fatalf("unexpected upstream path %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"status": "success",
			"data": {
				"id": "poem-1",
				"content": "斜月沉沉藏海雾，碣石潇湘无限路。",
				"popularity": 334000,
				"cacheAt": "2026-05-22T23:16:49Z",
				"origin": {
					"title": "春江花月夜",
					"dynasty": "唐代",
					"author": "张若虚",
					"content": ["春江潮水连海平，海上明月共潮生。"],
					"translate": ["春天的江潮水势浩荡，与大海连成一片。"]
				}
			}
		}`))
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testItabPoemCache(t)
	router.GET("/api/itab/poem", func(c *gin.Context) {
		serveItabPoemWithOptions(c, itabPoemHandlerOptions{
			client:          upstream.Client(),
			cache:           cache,
			upstreamBaseURL: upstream.URL,
		})
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/itab/poem", nil))
		if w.Code != http.StatusOK {
			t.Fatalf("request %d expected 200, got %d: %s", i+1, w.Code, w.Body.String())
		}
		var payload struct {
			Success bool         `json:"success"`
			Data    ItabPoemData `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if !payload.Success || payload.Data.SourceStatus != "ok" {
			t.Fatalf("unexpected payload %#v", payload)
		}
		if payload.Data.PoemTitle != "春江花月夜" || len(payload.Data.FullText) != 1 || len(payload.Data.Translation) != 1 {
			t.Fatalf("unexpected poem data %#v", payload.Data)
		}
	}
	if requestCount != 1 {
		t.Fatalf("expected cache hit to make one upstream request, got %d", requestCount)
	}
}

func TestItabPoemRefreshBypassesCache(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{
			"status": "success",
			"data": {
				"id": "poem-%d",
				"content": "名句 %d",
				"origin": {
					"title": "标题",
					"dynasty": "唐代",
					"author": "作者",
					"content": ["名句 %d"]
				}
			}
		}`, requestCount, requestCount, requestCount)
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testItabPoemCache(t)
	router.GET("/api/itab/poem", func(c *gin.Context) {
		serveItabPoemWithOptions(c, itabPoemHandlerOptions{
			client:          upstream.Client(),
			cache:           cache,
			upstreamBaseURL: upstream.URL,
		})
	})

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/itab/poem", nil))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/itab/poem?refresh=true", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if requestCount != 2 {
		t.Fatalf("expected refresh to bypass cache, got %d upstream requests", requestCount)
	}
}

func TestItabPoemReturnsStaleCacheOnRefreshFailure(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream down", http.StatusBadGateway)
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testItabPoemCache(t)
	_ = cache.Set(widgetCacheKindItabPoem, itabPoemCacheKey, ItabPoemData{
		Sentence:  "cached",
		PoemTitle: "cached title",
		Author:    "cached author",
		Dynasty:   "唐代",
		FullText:  []string{"cached"},
	}, time.Millisecond, "ok")
	time.Sleep(3 * time.Millisecond)

	router.GET("/api/itab/poem", func(c *gin.Context) {
		serveItabPoemWithOptions(c, itabPoemHandlerOptions{
			client:          upstream.Client(),
			cache:           cache,
			upstreamBaseURL: upstream.URL,
		})
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/itab/poem?refresh=true", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected stale 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"sourceStatus":"stale"`) {
		t.Fatalf("expected stale response, got %s", w.Body.String())
	}
}
