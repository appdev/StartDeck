package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
)

func testItabResourceRouter(options itabResourceHandlerOptions) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/itab-resources/:resourceId", func(c *gin.Context) {
		serveItabResourceWithOptions(c, options)
	})
	r.HEAD("/api/itab-resources/:resourceId", func(c *gin.Context) {
		serveItabResourceWithOptions(c, options)
	})
	r.POST("/api/itab-resources/:resourceId", func(c *gin.Context) {
		serveItabResourceWithOptions(c, options)
	})
	return r
}

func testManifestEntry(t *testing.T, resourceID string, rawURL string) ItabResourceManifestEntry {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(parsed.String()))
	return ItabResourceManifestEntry{
		ResourceID:   resourceID,
		URL:          parsed.String(),
		Host:         parsed.Hostname(),
		Path:         parsed.EscapedPath(),
		ContentTypes: []string{"image/png"},
		MaxBytes:     32,
		AuditHash:    hex.EncodeToString(sum[:]),
	}
}

func TestItabResourceEndpointRequiresManifestResourceId(t *testing.T) {
	router := testItabResourceRouter(itabResourceHandlerOptions{
		manifest: map[string]ItabResourceManifestEntry{},
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/itab-resources/missing?url=https://example.com/a.png", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown resource id, got %d", w.Code)
	}
}

func TestItabResourceEndpointRejectsUnsupportedMethods(t *testing.T) {
	router := testItabResourceRouter(itabResourceHandlerOptions{
		manifest: map[string]ItabResourceManifestEntry{},
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/itab-resources/anything", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for POST, got %d", w.Code)
	}
}

func TestItabResourceEndpointStripsCallerCredentialsAndStreamsAllowedImage(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("Referer") != "" {
			t.Fatalf("caller credentials were forwarded: %#v", r.Header)
		}
		if r.Method != http.MethodGet {
			t.Fatalf("expected GET upstream, got %s", r.Method)
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("png"))
	}))
	defer upstream.Close()

	const resourceID = "itab-test-image"
	entry := testManifestEntry(t, resourceID, upstream.URL+"/asset.png")
	client := upstream.Client()
	router := testItabResourceRouter(itabResourceHandlerOptions{
		client:              client,
		allowPrivateNetwork: true,
		manifest:            map[string]ItabResourceManifestEntry{resourceID: entry},
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/itab-resources/"+resourceID+"?url=https://evil.example/a.png", nil)
	req.Header.Set("Cookie", "sid=secret")
	req.Header.Set("Authorization", "Bearer secret")
	req.Header.Set("Referer", "https://private.example/")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if w.Body.String() != "png" {
		t.Fatalf("unexpected body %q", w.Body.String())
	}
	if got := w.Header().Get("X-Itab-Resource-Id"); got != resourceID {
		t.Fatalf("missing resource id response header: %q", got)
	}
}

func TestItabResourceEndpointRejectsUnsafeManifestTargets(t *testing.T) {
	entry := ItabResourceManifestEntry{
		ResourceID:   "bad",
		URL:          "http://127.0.0.1/asset.png",
		Host:         "127.0.0.1",
		Path:         "/asset.png",
		ContentTypes: []string{"image/png"},
		MaxBytes:     32,
	}
	if _, err := validateItabResourceTarget(entry); err == nil {
		t.Fatal("expected non-https manifest target to be rejected")
	}
	if !isPrivateOrUnsafeIP(netParseIP("127.0.0.1")) {
		t.Fatal("expected loopback IP to be unsafe")
	}
}

func netParseIP(value string) net.IP { return net.ParseIP(value) }
