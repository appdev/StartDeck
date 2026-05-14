package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"startdeck-backend/config"
	"startdeck-backend/models"

	"github.com/gin-gonic/gin"
)

func withTempDataConfig(t *testing.T, systemJSON string, dataJSON string) {
	t.Helper()

	tempDir := t.TempDir()
	dataDir := filepath.Join(tempDir, "data")
	usersDir := filepath.Join(dataDir, "users")
	if err := os.MkdirAll(usersDir, 0755); err != nil {
		t.Fatalf("mkdir users dir: %v", err)
	}

	systemFile := filepath.Join(dataDir, "system.json")
	dataFile := filepath.Join(dataDir, "data.json")
	if err := os.WriteFile(systemFile, []byte(systemJSON), 0644); err != nil {
		t.Fatalf("write system config: %v", err)
	}
	if err := os.WriteFile(dataFile, []byte(dataJSON), 0644); err != nil {
		t.Fatalf("write data file: %v", err)
	}

	oldDataDir := config.DataDir
	oldUsersDir := config.UsersDir
	oldSystemConfigFile := config.SystemConfigFile
	oldSysConfigCache := sysConfigCache
	oldSysConfigCacheMod := sysConfigCacheMod
	oldGetDataCache := getDataCache
	config.DataDir = dataDir
	config.UsersDir = usersDir
	config.SystemConfigFile = systemFile
	sysConfigCache = models.SystemConfig{}
	sysConfigCacheMod = time.Time{}
	getDataCache = map[string]getDataCacheEntry{}
	t.Cleanup(func() {
		config.DataDir = oldDataDir
		config.UsersDir = oldUsersDir
		config.SystemConfigFile = oldSystemConfigFile
		sysConfigCache = oldSysConfigCache
		sysConfigCacheMod = oldSysConfigCacheMod
		getDataCache = oldGetDataCache
	})
}

func TestGetDataSupportsETagRevalidation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tempDir := t.TempDir()
	dataDir := filepath.Join(tempDir, "data")
	usersDir := filepath.Join(dataDir, "users")
	if err := os.MkdirAll(usersDir, 0755); err != nil {
		t.Fatalf("mkdir users dir: %v", err)
	}

	systemFile := filepath.Join(dataDir, "system.json")
	dataFile := filepath.Join(dataDir, "data.json")
	if err := os.WriteFile(systemFile, []byte(`{"authMode":"single","enableDocker":true}`), 0644); err != nil {
		t.Fatalf("write system config: %v", err)
	}
	if err := os.WriteFile(dataFile, []byte(`{"groups":[],"widgets":[],"rssFeeds":[],"rssCategories":[],"version":1}`), 0644); err != nil {
		t.Fatalf("write data file: %v", err)
	}

	oldDataDir := config.DataDir
	oldUsersDir := config.UsersDir
	oldSystemConfigFile := config.SystemConfigFile
	oldSysConfigCache := sysConfigCache
	oldSysConfigCacheMod := sysConfigCacheMod
	oldGetDataCache := getDataCache
	config.DataDir = dataDir
	config.UsersDir = usersDir
	config.SystemConfigFile = systemFile
	sysConfigCache = models.SystemConfig{}
	sysConfigCacheMod = time.Time{}
	getDataCache = map[string]getDataCacheEntry{}
	t.Cleanup(func() {
		config.DataDir = oldDataDir
		config.UsersDir = oldUsersDir
		config.SystemConfigFile = oldSystemConfigFile
		sysConfigCache = oldSysConfigCache
		sysConfigCacheMod = oldSysConfigCacheMod
		getDataCache = oldGetDataCache
	})

	router := gin.New()
	router.GET("/api/data", GetData)

	firstRecorder := httptest.NewRecorder()
	firstRequest := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	router.ServeHTTP(firstRecorder, firstRequest)
	if firstRecorder.Code != http.StatusOK {
		t.Fatalf("expected first request 200, got %d", firstRecorder.Code)
	}
	etag := firstRecorder.Header().Get("ETag")
	if etag == "" {
		t.Fatal("expected ETag header on first response")
	}
	if got := firstRecorder.Header().Get("Cache-Control"); got != "private, no-cache, must-revalidate" {
		t.Fatalf("unexpected Cache-Control %q", got)
	}

	secondRecorder := httptest.NewRecorder()
	secondRequest := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	secondRequest.Header.Set("If-None-Match", etag)
	router.ServeHTTP(secondRecorder, secondRequest)
	if secondRecorder.Code != http.StatusNotModified {
		t.Fatalf(
			"expected second request 304, got %d (first=%q second=%q)",
			secondRecorder.Code,
			etag,
			secondRecorder.Header().Get("ETag"),
		)
	}
	if got := secondRecorder.Header().Get("ETag"); got != etag {
		t.Fatalf("expected same ETag %q, got %q", etag, got)
	}
}

func TestNormalizeEmbeddedAssetRefsCachesDataImage(t *testing.T) {
	tempDir := t.TempDir()
	oldIconCacheDir := config.IconCacheDir
	config.IconCacheDir = tempDir
	t.Cleanup(func() {
		config.IconCacheDir = oldIconCacheDir
	})

	payload := map[string]interface{}{
		"groups": []interface{}{
			map[string]interface{}{
				"title": "demo",
				"items": []interface{}{
					map[string]interface{}{
						"title": "demo-item",
						"icon":  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yR4QAAAAASUVORK5CYII=",
					},
				},
			},
		},
	}

	if !normalizeEmbeddedAssetRefs(payload) {
		t.Fatal("expected embedded asset refs to be normalized")
	}

	groups := payload["groups"].([]interface{})
	group := groups[0].(map[string]interface{})
	items := group["items"].([]interface{})
	item := items[0].(map[string]interface{})
	icon, _ := item["icon"].(string)
	if !strings.HasPrefix(icon, "/icon-cache/") {
		t.Fatalf("expected cached icon path, got %q", icon)
	}
	if _, err := os.Stat(filepath.Join(tempDir, filepath.Base(icon))); err != nil {
		t.Fatalf("expected cached icon file to exist: %v", err)
	}
}

func TestGetWidgetGuestCanOnlyReadPublicWidget(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withTempDataConfig(
		t,
		`{"authMode":"single"}`,
		`{
			"groups": [],
			"widgets": [
				{"id":"private-todo","type":"todo","enable":true,"isPublic":false,"data":[{"id":"1","text":"secret","done":false}]},
				{"id":"public-todo","type":"todo","enable":true,"isPublic":true,"data":[{"id":"2","text":"public todo","done":false}]},
				{"id":"public-memo","type":"memo","enable":true,"isPublic":true,"data":{"content":"public memo","server_ts":1,"mode":"simple"}},
				{"id":"public-widget","type":"custom","enable":true,"isPublic":true,"data":{"title":"public","lanUrl":"http://secret.lan","nested":{"lanHost":"private-host"}}}
			],
			"version": 1
		}`,
	)

	router := gin.New()
	router.GET("/api/widgets/:id", GetWidget)

	privateRecorder := httptest.NewRecorder()
	privateRequest := httptest.NewRequest(http.MethodGet, "/api/widgets/private-todo", nil)
	router.ServeHTTP(privateRecorder, privateRequest)
	if privateRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected guest private widget read to be 404, got %d", privateRecorder.Code)
	}

	publicTodoRecorder := httptest.NewRecorder()
	publicTodoRequest := httptest.NewRequest(http.MethodGet, "/api/widgets/public-todo", nil)
	router.ServeHTTP(publicTodoRecorder, publicTodoRequest)
	if publicTodoRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected guest public todo read to be 404, got %d", publicTodoRecorder.Code)
	}

	publicMemoRecorder := httptest.NewRecorder()
	publicMemoRequest := httptest.NewRequest(http.MethodGet, "/api/widgets/public-memo", nil)
	router.ServeHTTP(publicMemoRecorder, publicMemoRequest)
	if publicMemoRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected guest public memo read to be 404, got %d", publicMemoRecorder.Code)
	}

	publicRecorder := httptest.NewRecorder()
	publicRequest := httptest.NewRequest(http.MethodGet, "/api/widgets/public-widget", nil)
	router.ServeHTTP(publicRecorder, publicRequest)
	if publicRecorder.Code != http.StatusOK {
		t.Fatalf("expected guest public widget read to be 200, got %d", publicRecorder.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(publicRecorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	data, ok := body["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data object, got %#v", body["data"])
	}
	if _, exists := data["lanUrl"]; exists {
		t.Fatalf("expected lanUrl to be stripped for guests")
	}
	nested, _ := data["nested"].(map[string]interface{})
	if _, exists := nested["lanHost"]; exists {
		t.Fatalf("expected nested lanHost to be stripped for guests")
	}
}

func TestGetDataGuestKeepsPublicMemoAndTodoShells(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withTempDataConfig(
		t,
		`{"authMode":"single"}`,
		`{
			"groups": [],
			"widgets": [
				{"id":"public-clock","type":"clock","enable":true,"isPublic":true},
				{"id":"public-todo","type":"todo","enable":true,"isPublic":true,"data":[{"id":"1","text":"public todo","done":false}]},
				{"id":"public-memo","type":"memo","enable":true,"isPublic":true,"data":{"content":"public memo","server_ts":1,"mode":"simple"}}
			],
			"version": 1
		}`,
	)

	router := gin.New()
	router.GET("/api/data", GetData)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected guest data read to be 200, got %d", recorder.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	widgets, ok := body["widgets"].([]interface{})
	if !ok {
		t.Fatalf("expected widgets array, got %#v", body["widgets"])
	}
	if len(widgets) != 3 {
		t.Fatalf("expected public widgets to remain visible, got %d widgets", len(widgets))
	}
	byID := map[string]map[string]interface{}{}
	for _, raw := range widgets {
		widget, ok := raw.(map[string]interface{})
		if !ok {
			t.Fatalf("expected widget object, got %#v", raw)
		}
		id, _ := widget["id"].(string)
		byID[id] = widget
	}
	if _, ok := byID["public-clock"]; !ok {
		t.Fatal("expected public-clock to remain")
	}
	for _, id := range []string{"public-todo", "public-memo"} {
		widget, ok := byID[id]
		if !ok {
			t.Fatalf("expected %s shell to remain", id)
		}
		if _, exists := widget["data"]; exists {
			t.Fatalf("expected %s data to be hidden from guest response", id)
		}
	}
}

func TestGetWidgetAuthenticatedCanReadPrivateWidget(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withTempDataConfig(
		t,
		`{"authMode":"single"}`,
		`{
			"groups": [],
			"widgets": [
				{"id":"private-todo","type":"todo","enable":true,"isPublic":false,"data":[{"id":"1","text":"secret","done":false}]}
			],
			"version": 1
		}`,
	)

	router := gin.New()
	router.GET("/api/widgets/:id", func(c *gin.Context) {
		c.Set("username", "admin")
		GetWidget(c)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/widgets/private-todo", nil)
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected authenticated private widget read to be 200, got %d", recorder.Code)
	}
}
