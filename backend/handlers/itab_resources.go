package handlers

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"startdeck-backend/internal/itabresources"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type ItabResourceManifestEntry struct {
	ResourceID   string
	URL          string
	Host         string
	Path         string
	QueryKeys    []string
	ContentTypes []string
	MaxBytes     int64
	AuditHash    string
}

type itabResourceHandlerOptions struct {
	client              *http.Client
	manifest            map[string]ItabResourceManifestEntry
	allowPrivateNetwork bool
}

const defaultItabResourceTimeout = 6 * time.Second

func generatedItabResourceManifest() map[string]ItabResourceManifestEntry {
	manifest := make(map[string]ItabResourceManifestEntry, len(itabresources.GeneratedManifest))
	for id, item := range itabresources.GeneratedManifest {
		manifest[id] = ItabResourceManifestEntry{
			ResourceID:   item.ResourceID,
			URL:          item.URL,
			Host:         item.Host,
			Path:         item.Path,
			QueryKeys:    item.QueryKeys,
			ContentTypes: item.ContentTypes,
			MaxBytes:     item.MaxBytes,
			AuditHash:    item.AuditHash,
		}
	}
	return manifest
}

func GetItabResource(c *gin.Context) {
	serveItabResourceWithOptions(c, itabResourceHandlerOptions{
		client:   newItabResourceHTTPClient(false),
		manifest: generatedItabResourceManifest(),
	})
}

func newItabResourceHTTPClient(allowPrivateNetwork bool) *http.Client {
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		ResponseHeaderTimeout: defaultItabResourceTimeout,
		ExpectContinueTimeout: 1 * time.Second,
		IdleConnTimeout:       30 * time.Second,
		DialContext:           publicOnlyDialContext(allowPrivateNetwork),
	}
	return &http.Client{
		Timeout:   defaultItabResourceTimeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func publicOnlyDialContext(allowPrivateNetwork bool) func(context.Context, string, string) (net.Conn, error) {
	return func(ctx context.Context, network string, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		resolved, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, err
		}
		for _, candidate := range resolved {
			if !allowPrivateNetwork && isPrivateOrUnsafeIP(candidate.IP) {
				continue
			}
			var dialer net.Dialer
			return dialer.DialContext(ctx, network, net.JoinHostPort(candidate.IP.String(), port))
		}
		return nil, fmt.Errorf("itab resource host has no allowed public address")
	}
}

func isPrivateOrUnsafeIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	return ip.IsLoopback() ||
		ip.IsPrivate() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsUnspecified() ||
		ip.IsMulticast()
}

func serveItabResourceWithOptions(c *gin.Context, options itabResourceHandlerOptions) {
	if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "method not allowed"})
		return
	}
	resourceID := strings.TrimSpace(c.Param("resourceId"))
	if resourceID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "resource not found"})
		return
	}
	entry, ok := options.manifest[resourceID]
	if !ok || entry.ResourceID != resourceID {
		c.JSON(http.StatusNotFound, gin.H{"error": "resource not found"})
		return
	}
	target, err := validateItabResourceTarget(entry)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "resource manifest rejected"})
		return
	}
	client := options.client
	if client == nil {
		client = newItabResourceHTTPClient(options.allowPrivateNetwork)
	}
	req, err := buildItabResourceRequest(c.Request.Context(), c.Request.Method, target)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "request build failed"})
		return
	}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "resource fetch failed"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "resource redirect rejected"})
		return
	}
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "resource upstream status rejected"})
		return
	}
	contentType := strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0])
	if !isAllowedContentType(contentType, entry.ContentTypes) {
		c.JSON(http.StatusBadGateway, gin.H{"error": "resource content type rejected"})
		return
	}
	if resp.ContentLength > entry.MaxBytes && entry.MaxBytes > 0 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "resource too large"})
		return
	}
	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
	c.Header("X-Itab-Resource-Id", entry.ResourceID)
	c.Header("X-Itab-Resource-Audit", redactedAuditHash(entry.AuditHash))
	if c.Request.Method == http.MethodHead {
		c.Status(http.StatusOK)
		return
	}
	limit := entry.MaxBytes
	if limit <= 0 {
		limit = 256 * 1024
	}
	reader := io.LimitReader(resp.Body, limit+1)
	written, err := io.Copy(c.Writer, reader)
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}
	if written > limit {
		c.Status(http.StatusBadGateway)
		return
	}
}

func validateItabResourceTarget(entry ItabResourceManifestEntry) (*url.URL, error) {
	if entry.ResourceID == "" || entry.URL == "" {
		return nil, errors.New("missing resource metadata")
	}
	parsed, err := url.Parse(entry.URL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return nil, errors.New("invalid resource url")
	}
	if !strings.EqualFold(parsed.Hostname(), entry.Host) || parsed.EscapedPath() != entry.Path {
		return nil, errors.New("resource host/path mismatch")
	}
	allowedQueryKeys := map[string]struct{}{}
	for _, key := range entry.QueryKeys {
		allowedQueryKeys[key] = struct{}{}
	}
	for key := range parsed.Query() {
		if _, ok := allowedQueryKeys[key]; !ok {
			return nil, errors.New("resource query rejected")
		}
	}
	sum := sha256.Sum256([]byte(parsed.String()))
	if entry.AuditHash != "" && subtle.ConstantTimeCompare([]byte(hex.EncodeToString(sum[:])), []byte(entry.AuditHash)) != 1 {
		return nil, errors.New("resource audit hash mismatch")
	}
	return parsed, nil
}

func buildItabResourceRequest(ctx context.Context, method string, target *url.URL) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, target.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "image/avif,image/webp,image/png,image/jpeg,image/svg+xml;q=0.9,*/*;q=0.1")
	req.Header.Set("User-Agent", "StartDeck-iTabResource/1.0")
	return req, nil
}

func isAllowedContentType(contentType string, allowed []string) bool {
	for _, candidate := range allowed {
		if strings.EqualFold(contentType, candidate) {
			return true
		}
	}
	return false
}

func redactedAuditHash(value string) string {
	if len(value) <= 12 {
		return value
	}
	return value[:12]
}
