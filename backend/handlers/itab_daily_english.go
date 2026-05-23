package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	itabDailyEnglishUpstreamURL = "https://base.itab.link/itab/todayEnglish"
	itabDailyEnglishCacheKey    = "today:v1"
	itabDailyEnglishRefreshTag  = widgetCacheKindItabDailyEnglish + ":" + itabDailyEnglishCacheKey
	itabDailyEnglishTTL         = 6 * time.Hour
	itabDailyEnglishMaxBody     = 128 * 1024
	itabDailyEnglishMediaMax    = 3 * 1024 * 1024
	itabDailyEnglishFallbackImg = "https://staticedu-wps-cache.iciba.com/image/fa0ba1a3b8cc0bc45195b87a9e7dc82f.png"
)

type ItabDailyEnglishData struct {
	Mode          string `json:"mode"`
	Sentence      string `json:"sentence"`
	Translation   string `json:"translation"`
	ProgressLabel string `json:"progressLabel"`
	ImageURL      string `json:"imageUrl"`
	AudioURL      string `json:"audioUrl"`
	Dateline      string `json:"dateline"`
	SourceStatus  string `json:"sourceStatus"`
}

type itabDailyEnglishHandlerOptions struct {
	client              *http.Client
	cache               *WidgetCache
	upstreamURL         string
	allowUnsafeMediaURL bool
}

type itabDailyEnglishUpstreamResponse struct {
	Code     int                           `json:"code"`
	Errno    int                           `json:"errno"`
	Msg      string                        `json:"msg"`
	Content  string                        `json:"content"`
	Note     string                        `json:"note"`
	Picture  string                        `json:"picture"`
	Picture2 string                        `json:"picture2"`
	TTS      string                        `json:"tts"`
	Dateline string                        `json:"dateline"`
	Data     *itabDailyEnglishUpstreamData `json:"data"`
}

type itabDailyEnglishUpstreamData struct {
	Content  string `json:"content"`
	Note     string `json:"note"`
	Picture  string `json:"picture"`
	Picture2 string `json:"picture2"`
	TTS      string `json:"tts"`
	Dateline string `json:"dateline"`
}

func GetItabDailyEnglish(c *gin.Context) {
	serveItabDailyEnglishWithOptions(c, itabDailyEnglishHandlerOptions{})
}

func GetItabDailyEnglishMedia(c *gin.Context) {
	serveItabDailyEnglishMediaWithOptions(c, itabDailyEnglishHandlerOptions{})
}

func serveItabDailyEnglishWithOptions(c *gin.Context, options itabDailyEnglishHandlerOptions) {
	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"success": false, "error": "method not allowed"})
		return
	}
	refresh := strings.EqualFold(c.Query("refresh"), "true")
	cache := itabDailyEnglishCache(options)
	var cached ItabDailyEnglishData
	hasCache, isFresh, item, err := cache.Get(widgetCacheKindItabDailyEnglish, itabDailyEnglishCacheKey, &cached)
	if err == nil && hasCache && isFresh && !refresh {
		status := "ok"
		if item != nil && item.SourceStatus != "" {
			status = item.SourceStatus
		}
		writeItabDailyEnglishResponse(c, cached, status)
		return
	}
	if err == nil && hasCache && !isFresh && !refresh {
		go refreshItabDailyEnglishAsync(options)
		writeItabDailyEnglishResponse(c, cached, "stale")
		return
	}

	data, fetchErr := fetchItabDailyEnglish(c.Request.Context(), itabDailyEnglishClient(options), itabDailyEnglishUpstream(options))
	if fetchErr != nil {
		_ = cache.MarkStatus(widgetCacheKindItabDailyEnglish, itabDailyEnglishCacheKey, "error")
		if hasCache {
			writeItabDailyEnglishResponse(c, cached, "stale")
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fetchErr.Error()})
		return
	}
	_ = cache.Set(widgetCacheKindItabDailyEnglish, itabDailyEnglishCacheKey, data, itabDailyEnglishTTL, "ok")
	writeItabDailyEnglishResponse(c, data, "ok")
}

func refreshItabDailyEnglishAsync(options itabDailyEnglishHandlerOptions) {
	cache := itabDailyEnglishCache(options)
	if !cache.StartRefresh(itabDailyEnglishRefreshTag) {
		return
	}
	defer cache.EndRefresh(itabDailyEnglishRefreshTag)

	ctx, cancel := context.WithTimeout(context.Background(), defaultItabResourceTimeout)
	defer cancel()
	data, err := fetchItabDailyEnglish(ctx, itabDailyEnglishClient(options), itabDailyEnglishUpstream(options))
	if err != nil {
		_ = cache.MarkStatus(widgetCacheKindItabDailyEnglish, itabDailyEnglishCacheKey, "error")
		return
	}
	_ = cache.Set(widgetCacheKindItabDailyEnglish, itabDailyEnglishCacheKey, data, itabDailyEnglishTTL, "ok")
}

func itabDailyEnglishCache(options itabDailyEnglishHandlerOptions) *WidgetCache {
	if options.cache != nil {
		return options.cache
	}
	return sharedWidgetCache
}

func itabDailyEnglishClient(options itabDailyEnglishHandlerOptions) *http.Client {
	if options.client != nil {
		return options.client
	}
	return newItabResourceHTTPClient(false)
}

func itabDailyEnglishUpstream(options itabDailyEnglishHandlerOptions) string {
	if strings.TrimSpace(options.upstreamURL) != "" {
		return strings.TrimSpace(options.upstreamURL)
	}
	return itabDailyEnglishUpstreamURL
}

func writeItabDailyEnglishResponse(c *gin.Context, data ItabDailyEnglishData, status string) {
	data.SourceStatus = status
	if data.ImageURL != "" {
		data.ImageURL = itabDailyEnglishMediaPath("image")
	}
	if data.AudioURL != "" {
		data.AudioURL = itabDailyEnglishMediaPath("audio")
	}
	c.Header("Cache-Control", "public, max-age=300, stale-while-revalidate=21600")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data, "sourceStatus": status})
}

func serveItabDailyEnglishMediaWithOptions(c *gin.Context, options itabDailyEnglishHandlerOptions) {
	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "method not allowed"})
		return
	}
	kind := strings.TrimSpace(c.Param("kind"))
	if kind != "image" && kind != "audio" {
		c.JSON(http.StatusNotFound, gin.H{"error": "daily English media not found"})
		return
	}
	data, err := currentItabDailyEnglishData(c.Request.Context(), options)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	targetURL := data.ImageURL
	if kind == "audio" {
		targetURL = data.AudioURL
	}
	if targetURL == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "daily English media not found"})
		return
	}

	allowedTypes := []string{"image/webp", "image/png", "image/jpeg", "image/avif"}
	accept := "image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1"
	if kind == "audio" {
		allowedTypes = []string{"audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/x-wav"}
		accept = "audio/mpeg,audio/mp4,audio/wav;q=0.9,*/*;q=0.1"
	}
	if !options.allowUnsafeMediaURL && sanitizeItabDailyEnglishURL(targetURL) == "" {
		c.JSON(http.StatusBadGateway, gin.H{"error": "daily English media url rejected"})
		return
	}
	target, err := url.Parse(targetURL)
	if err != nil || target.Scheme != "https" || target.Host == "" || target.User != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "daily English media url rejected"})
		return
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, target.String(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "request build failed"})
		return
	}
	req.Header.Set("Accept", accept)
	req.Header.Set("User-Agent", "StartDeck-iTabDailyEnglish/1.0")
	resp, err := itabDailyEnglishClient(options).Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "daily English media fetch failed"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "daily English media redirect rejected"})
		return
	}
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "daily English media status rejected"})
		return
	}
	contentType := strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0])
	if !isAllowedContentType(contentType, allowedTypes) {
		c.JSON(http.StatusBadGateway, gin.H{"error": "daily English media type rejected"})
		return
	}
	if resp.ContentLength > itabDailyEnglishMediaMax {
		c.JSON(http.StatusBadGateway, gin.H{"error": "daily English media too large"})
		return
	}
	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
	reader := io.LimitReader(resp.Body, itabDailyEnglishMediaMax+1)
	written, err := io.Copy(c.Writer, reader)
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}
	if written > itabDailyEnglishMediaMax {
		c.Status(http.StatusBadGateway)
	}
}

func currentItabDailyEnglishData(ctx context.Context, options itabDailyEnglishHandlerOptions) (ItabDailyEnglishData, error) {
	cache := itabDailyEnglishCache(options)
	var cached ItabDailyEnglishData
	hasCache, _, _, err := cache.Get(widgetCacheKindItabDailyEnglish, itabDailyEnglishCacheKey, &cached)
	if err == nil && hasCache {
		return cached, nil
	}
	data, fetchErr := fetchItabDailyEnglish(ctx, itabDailyEnglishClient(options), itabDailyEnglishUpstream(options))
	if fetchErr != nil {
		return ItabDailyEnglishData{}, fetchErr
	}
	_ = cache.Set(widgetCacheKindItabDailyEnglish, itabDailyEnglishCacheKey, data, itabDailyEnglishTTL, "ok")
	return data, nil
}

func itabDailyEnglishMediaPath(kind string) string {
	return "/api/itab/today-english/media/" + kind
}

func fetchItabDailyEnglish(ctx context.Context, client *http.Client, upstream string) (ItabDailyEnglishData, error) {
	if client == nil {
		client = newItabResourceHTTPClient(false)
	}
	req, err := buildItabDailyEnglishRequest(ctx, upstream)
	if err != nil {
		return ItabDailyEnglishData{}, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return ItabDailyEnglishData{}, fmt.Errorf("daily English upstream fetch failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		return ItabDailyEnglishData{}, errors.New("daily English redirect rejected")
	}
	if resp.StatusCode != http.StatusOK {
		return ItabDailyEnglishData{}, fmt.Errorf("daily English upstream status rejected: %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, itabDailyEnglishMaxBody+1))
	if err != nil {
		return ItabDailyEnglishData{}, err
	}
	if int64(len(body)) > itabDailyEnglishMaxBody {
		return ItabDailyEnglishData{}, errors.New("daily English response too large")
	}
	var payload itabDailyEnglishUpstreamResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return ItabDailyEnglishData{}, errors.New("daily English malformed json")
	}
	if payload.Code != 0 && payload.Code != http.StatusOK {
		if strings.TrimSpace(payload.Msg) != "" {
			return ItabDailyEnglishData{}, errors.New(payload.Msg)
		}
		return ItabDailyEnglishData{}, fmt.Errorf("daily English upstream code rejected: %d", payload.Code)
	}
	if payload.Errno != 0 {
		return ItabDailyEnglishData{}, fmt.Errorf("daily English upstream errno rejected: %d", payload.Errno)
	}
	return normalizeItabDailyEnglish(payload)
}

func buildItabDailyEnglishRequest(ctx context.Context, upstream string) (*http.Request, error) {
	parsed, err := url.Parse(strings.TrimSpace(upstream))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return nil, errors.New("daily English upstream url rejected")
	}
	query := parsed.Query()
	query.Set("lang", "cn")
	parsed.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "StartDeck-iTabDailyEnglish/1.0")
	return req, nil
}

func normalizeItabDailyEnglish(payload itabDailyEnglishUpstreamResponse) (ItabDailyEnglishData, error) {
	data := itabDailyEnglishUpstreamData{
		Content:  payload.Content,
		Note:     payload.Note,
		Picture:  payload.Picture,
		Picture2: payload.Picture2,
		TTS:      payload.TTS,
		Dateline: payload.Dateline,
	}
	if payload.Data != nil {
		data = *payload.Data
	}
	sentence := strings.TrimSpace(data.Content)
	translation := strings.TrimSpace(data.Note)
	if sentence == "" || translation == "" {
		return ItabDailyEnglishData{}, errors.New("daily English sentence missing")
	}
	imageURL := sanitizeItabDailyEnglishURL(data.Picture2)
	if imageURL == "" {
		imageURL = sanitizeItabDailyEnglishURL(data.Picture)
	}
	if imageURL == "" {
		imageURL = itabDailyEnglishFallbackImg
	}
	return ItabDailyEnglishData{
		Mode:          "跟读",
		Sentence:      sentence,
		Translation:   translation,
		ProgressLabel: "00:00",
		ImageURL:      imageURL,
		AudioURL:      sanitizeItabDailyEnglishURL(data.TTS),
		Dateline:      normalizeItabDailyEnglishDateline(data.Dateline),
	}, nil
}

func normalizeItabDailyEnglishDateline(value string) string {
	trimmed := strings.TrimSpace(value)
	if parsed, err := time.Parse("2006-01-02", trimmed); err == nil {
		return parsed.Format("2006-01-02")
	}
	if parsed, err := time.Parse("20060102", trimmed); err == nil {
		return parsed.Format("2006-01-02")
	}
	if trimmed != "" {
		return trimmed
	}
	return time.Now().Format("2006-01-02")
}

func sanitizeItabDailyEnglishURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return ""
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "staticedu-wps-cache.iciba.com" {
		return ""
	}
	return parsed.String()
}
