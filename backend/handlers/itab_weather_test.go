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

func testItabWeatherCache(t *testing.T) *WidgetCache {
	t.Helper()
	cachePath := filepath.Join(
		os.TempDir(),
		fmt.Sprintf(
			"startdeck-itab-weather-cache-%s-%d.json",
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

func TestItabWeatherCurrentFetchesAndCachesBundle(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("Referer") != "" {
			t.Fatalf("caller credentials were forwarded: %#v", r.Header)
		}
		if r.URL.Query().Get("lang") != "cn" {
			t.Fatalf("expected lang=cn, got %q", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/getWeather":
			if r.URL.Query().Get("location") != "101280601" || r.URL.Query().Get("type") != "city" {
				t.Fatalf("unexpected current query %q", r.URL.RawQuery)
			}
			_, _ = w.Write([]byte(`{
				"code": 200,
				"data": {
					"status": "ok",
					"now": {"tmp": "27", "cond_txt": "阴", "cond_code": "104"},
					"daily_forecast": [{"date": "2026-05-22", "tmp_max": "30", "tmp_min": "25", "cond_txt_d": "阴", "cond_code_d": "104"}]
				}
			}`))
		case "/weather/24":
			_, _ = w.Write([]byte(`{
				"code": 200,
				"data": {
					"updateTime": "2026-05-22T10:30+08:00",
					"hourly": [{"fxTime": "2026-05-22T11:00+08:00", "temp": "28", "icon": "100"}]
				}
			}`))
		default:
			t.Fatalf("unexpected upstream path %s", r.URL.Path)
		}
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testItabWeatherCache(t)
	router.GET("/api/itab/weather/current", func(c *gin.Context) {
		serveItabWeatherCurrentWithOptions(c, itabWeatherHandlerOptions{
			client:          upstream.Client(),
			cache:           cache,
			upstreamBaseURL: upstream.URL,
		})
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/itab/weather/current?location=101280601&type=city", nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d expected 200, got %d: %s", i+1, w.Code, w.Body.String())
		}
		var payload struct {
			Success bool                     `json:"success"`
			Data    ItabWeatherCurrentBundle `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if !payload.Success || payload.Data.SourceStatus != "ok" || payload.Data.Current.Status != "ok" {
			t.Fatalf("unexpected payload %#v", payload)
		}
	}
	if requestCount != 2 {
		t.Fatalf("expected current+hourly once due cache hit, got %d upstream requests", requestCount)
	}
}

func TestItabWeatherSearchValidatesKeywordAndCaches(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.URL.Path != "/weather/city" || r.URL.Query().Get("location") != "深圳" {
			t.Fatalf("unexpected search request %s?%s", r.URL.Path, r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": [
				{"name": "深圳", "id": "101280601", "adm1": "广东省", "adm2": "深圳", "type": "city"},
				{"name": "", "id": "bad"}
			]
		}`))
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testItabWeatherCache(t)
	router.GET("/api/itab/weather/search", func(c *gin.Context) {
		serveItabWeatherSearchWithOptions(c, itabWeatherHandlerOptions{
			client:          upstream.Client(),
			cache:           cache,
			upstreamBaseURL: upstream.URL,
		})
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/itab/weather/search?keyword=", nil))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid keyword 400, got %d", w.Code)
	}

	for i := 0; i < 2; i++ {
		w = httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/itab/weather/search?keyword=%E6%B7%B1%E5%9C%B3", nil))
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var payload struct {
			Data []ItabWeatherLocationData `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Data) != 1 || payload.Data[0].Name != "深圳" {
			t.Fatalf("unexpected search payload %#v", payload.Data)
		}
	}
	if requestCount != 1 {
		t.Fatalf("expected cached search to make one upstream request, got %d", requestCount)
	}
}

func TestItabWeatherLocationCachesDetectedLocation(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.URL.Path != "/getLocation" {
			t.Fatalf("unexpected location request %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": {"name": "深圳", "id": "101280601", "adm1": "广东省", "adm2": "深圳", "type": "city"}
		}`))
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testItabWeatherCache(t)
	router.GET("/api/itab/weather/location", func(c *gin.Context) {
		serveItabWeatherLocationWithOptions(c, itabWeatherHandlerOptions{
			client:          upstream.Client(),
			cache:           cache,
			upstreamBaseURL: upstream.URL,
		})
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/itab/weather/location", nil))
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), `"name":"深圳"`) {
			t.Fatalf("unexpected location payload %s", w.Body.String())
		}
	}
	if requestCount != 1 {
		t.Fatalf("expected cached location to make one request, got %d", requestCount)
	}
}

func TestItabWeatherCurrentReturnsStaleCacheOnRefreshFailure(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream down", http.StatusBadGateway)
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testItabWeatherCache(t)
	cacheKey := itabWeatherCurrentCacheKey("101280601", "city")
	_ = cache.Set(widgetCacheKindItabWeather, cacheKey, ItabWeatherCurrentBundle{
		Current: ItabWeatherCurrentData{Status: "ok"},
		Hourly:  ItabWeatherHourlyData{UpdateTime: "cached"},
	}, time.Millisecond, "ok")
	time.Sleep(3 * time.Millisecond)

	router.GET("/api/itab/weather/current", func(c *gin.Context) {
		serveItabWeatherCurrentWithOptions(c, itabWeatherHandlerOptions{
			client:          upstream.Client(),
			cache:           cache,
			upstreamBaseURL: upstream.URL,
		})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/itab/weather/current?location=101280601&type=city&refresh=true", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected stale 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"sourceStatus":"stale"`) {
		t.Fatalf("expected stale response, got %s", w.Body.String())
	}
}

func TestItabWeatherRejectsInvalidCurrentParamsAndMalformedJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	cache := testItabWeatherCache(t)
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`not-json`))
	}))
	defer upstream.Close()

	router.GET("/api/itab/weather/current", func(c *gin.Context) {
		serveItabWeatherCurrentWithOptions(c, itabWeatherHandlerOptions{
			client:          upstream.Client(),
			cache:           cache,
			upstreamBaseURL: upstream.URL,
		})
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/itab/weather/current?location=http://127.0.0.1&type=city", nil))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid location 400, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/itab/weather/current?location=101280601&type=city", nil))
	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected malformed upstream 502, got %d: %s", w.Code, w.Body.String())
	}
}
