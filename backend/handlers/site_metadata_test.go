package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetSiteMetadataUsesStartPageIconServerContract(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/site/metadata" {
			t.Fatalf("unexpected upstream path %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("url"); got != "https://example.com" {
			t.Fatalf("unexpected upstream url query %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"msg": "ok",
			"data": {
				"url": "https://example.com",
				"title": "Example",
				"icon": "/cache/example.png",
				"description": "Demo",
				"backgroundColor": "#ffffff",
				"fetchedAt": "2026-05-08T00:00:00Z"
			}
		}`))
	}))
	defer upstream.Close()
	t.Setenv("ICON_SERVER_BASE_URL", upstream.URL)

	router := gin.New()
	router.GET("/api/site/metadata", GetSiteMetadata)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/site/metadata?url=example.com", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var payload siteMetadataResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Code != http.StatusOK || payload.Data == nil {
		t.Fatalf("unexpected payload: %+v", payload)
	}
	if payload.Data.Title == nil || *payload.Data.Title != "Example" {
		t.Fatalf("unexpected title: %+v", payload.Data.Title)
	}
	if payload.Data.Icon == nil || *payload.Data.Icon != "/api/site/icon?url=https%3A%2F%2Fexample.com" {
		t.Fatalf("unexpected icon: %+v", payload.Data.Icon)
	}
}

func TestGetSiteIconProxiesProviderIcon(t *testing.T) {
	gin.SetMode(gin.TestMode)

	iconBytes := []byte{0x89, 0x50, 0x4e, 0x47}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/site/metadata":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"code": 200,
				"msg": "ok",
				"data": {
					"url": "https://example.com",
					"title": "Example",
					"icon": "/cache/example.png"
				}
			}`))
		case "/cache/example.png":
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(iconBytes)
		default:
			t.Fatalf("unexpected upstream path %s", r.URL.Path)
		}
	}))
	defer upstream.Close()
	t.Setenv("ICON_SERVER_BASE_URL", upstream.URL)

	router := gin.New()
	router.GET("/api/site/icon", GetSiteIcon)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/site/icon?url=example.com", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Header().Get("Content-Type"); got != "image/png" {
		t.Fatalf("unexpected content type %q", got)
	}
	if string(recorder.Body.Bytes()) != string(iconBytes) {
		t.Fatalf("unexpected icon body %v", recorder.Body.Bytes())
	}
}
