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
	itabPoemUpstreamBaseURL = "https://v2.jinrishici.com"
	itabPoemCacheKey        = "one"
	itabPoemTTL             = 30 * time.Minute
	itabPoemMaxBody         = 512 * 1024
)

type ItabPoemData struct {
	ID           string   `json:"id,omitempty"`
	Sentence     string   `json:"sentence"`
	PoemTitle    string   `json:"poemTitle"`
	Author       string   `json:"author"`
	Dynasty      string   `json:"dynasty"`
	FullText     []string `json:"fullText"`
	Translation  []string `json:"translation"`
	Annotations  []string `json:"annotations"`
	Preface      []string `json:"preface"`
	Popularity   int      `json:"popularity,omitempty"`
	CacheAt      string   `json:"cacheAt,omitempty"`
	SourceStatus string   `json:"sourceStatus"`
}

type itabPoemHandlerOptions struct {
	client          *http.Client
	cache           *WidgetCache
	upstreamBaseURL string
}

type itabPoemUpstreamOrigin struct {
	Title     string   `json:"title"`
	Dynasty   string   `json:"dynasty"`
	Author    string   `json:"author"`
	Content   []string `json:"content"`
	Translate []string `json:"translate"`
}

type itabPoemUpstreamData struct {
	ID         string                 `json:"id"`
	Content    string                 `json:"content"`
	Popularity int                    `json:"popularity"`
	Origin     itabPoemUpstreamOrigin `json:"origin"`
	CacheAt    string                 `json:"cacheAt"`
}

type itabPoemUpstreamResponse struct {
	Status string               `json:"status"`
	Data   itabPoemUpstreamData `json:"data"`
}

func GetItabPoem(c *gin.Context) {
	serveItabPoemWithOptions(c, itabPoemHandlerOptions{})
}

func serveItabPoemWithOptions(c *gin.Context, options itabPoemHandlerOptions) {
	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"success": false, "error": "method not allowed"})
		return
	}
	refresh := strings.EqualFold(c.Query("refresh"), "true")
	cache := itabPoemCache(options)
	var cached ItabPoemData
	hasCache, isFresh, item, err := cache.Get(widgetCacheKindItabPoem, itabPoemCacheKey, &cached)
	if err == nil && hasCache && isFresh && !refresh {
		status := "ok"
		if item != nil && item.SourceStatus != "" {
			status = item.SourceStatus
		}
		writeItabPoemResponse(c, cached, status)
		return
	}
	if err == nil && hasCache && !isFresh && !refresh {
		go refreshItabPoemAsync(options)
		writeItabPoemResponse(c, cached, "stale")
		return
	}

	data, fetchErr := fetchItabPoem(c.Request.Context(), itabPoemClient(options), itabPoemBaseURL(options))
	if fetchErr != nil {
		_ = cache.MarkStatus(widgetCacheKindItabPoem, itabPoemCacheKey, "error")
		if hasCache {
			writeItabPoemResponse(c, cached, "stale")
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fetchErr.Error()})
		return
	}
	_ = cache.Set(widgetCacheKindItabPoem, itabPoemCacheKey, data, itabPoemTTL, "ok")
	writeItabPoemResponse(c, data, "ok")
}

func refreshItabPoemAsync(options itabPoemHandlerOptions) {
	cache := itabPoemCache(options)
	tag := widgetCacheKindItabPoem + ":" + itabPoemCacheKey
	if !cache.StartRefresh(tag) {
		return
	}
	defer cache.EndRefresh(tag)
	ctx, cancel := context.WithTimeout(context.Background(), defaultItabResourceTimeout)
	defer cancel()
	data, err := fetchItabPoem(ctx, itabPoemClient(options), itabPoemBaseURL(options))
	if err != nil {
		_ = cache.MarkStatus(widgetCacheKindItabPoem, itabPoemCacheKey, "error")
		return
	}
	_ = cache.Set(widgetCacheKindItabPoem, itabPoemCacheKey, data, itabPoemTTL, "ok")
}

func itabPoemCache(options itabPoemHandlerOptions) *WidgetCache {
	if options.cache != nil {
		return options.cache
	}
	return sharedWidgetCache
}

func itabPoemClient(options itabPoemHandlerOptions) *http.Client {
	if options.client != nil {
		return options.client
	}
	return newItabResourceHTTPClient(false)
}

func itabPoemBaseURL(options itabPoemHandlerOptions) string {
	if strings.TrimSpace(options.upstreamBaseURL) != "" {
		return strings.TrimRight(strings.TrimSpace(options.upstreamBaseURL), "/")
	}
	return itabPoemUpstreamBaseURL
}

func writeItabPoemResponse(c *gin.Context, data ItabPoemData, status string) {
	data.SourceStatus = status
	c.Header("Cache-Control", "public, max-age=60, stale-while-revalidate=1800")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data, "sourceStatus": status})
}

func fetchItabPoem(ctx context.Context, client *http.Client, baseURL string) (ItabPoemData, error) {
	target, err := buildItabPoemURL(baseURL)
	if err != nil {
		return ItabPoemData{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return ItabPoemData{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "StartDeck-iTabPoem/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return ItabPoemData{}, fmt.Errorf("itab poem fetch failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		return ItabPoemData{}, errors.New("itab poem redirect rejected")
	}
	if resp.StatusCode != http.StatusOK {
		return ItabPoemData{}, fmt.Errorf("itab poem upstream status rejected: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, itabPoemMaxBody+1))
	if err != nil {
		return ItabPoemData{}, err
	}
	if int64(len(body)) > itabPoemMaxBody {
		return ItabPoemData{}, errors.New("itab poem response too large")
	}

	var payload itabPoemUpstreamResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return ItabPoemData{}, errors.New("itab poem malformed json")
	}
	if !strings.EqualFold(payload.Status, "success") {
		return ItabPoemData{}, errors.New("itab poem response failed")
	}
	data, err := normalizeItabPoemData(payload.Data)
	if err != nil {
		return ItabPoemData{}, err
	}
	return data, nil
}

func buildItabPoemURL(baseURL string) (string, error) {
	trimmedBase := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmedBase == "" {
		return "", errors.New("itab poem upstream url missing")
	}
	target, err := url.Parse(trimmedBase + "/one.json")
	if err != nil || target.Scheme != "https" || target.Host == "" || target.User != nil {
		return "", errors.New("itab poem upstream url rejected")
	}
	return target.String(), nil
}

func normalizeItabPoemData(data itabPoemUpstreamData) (ItabPoemData, error) {
	sentence := strings.TrimSpace(data.Content)
	title := strings.TrimSpace(data.Origin.Title)
	author := strings.TrimSpace(data.Origin.Author)
	dynasty := strings.TrimSpace(data.Origin.Dynasty)
	fullText := compactPoemLines(data.Origin.Content)
	if sentence == "" || title == "" || author == "" || dynasty == "" {
		return ItabPoemData{}, errors.New("itab poem response missing required fields")
	}
	if len(fullText) == 0 {
		fullText = []string{sentence}
	}
	return ItabPoemData{
		ID:           strings.TrimSpace(data.ID),
		Sentence:     sentence,
		PoemTitle:    title,
		Author:       author,
		Dynasty:      dynasty,
		FullText:     fullText,
		Translation:  compactPoemLines(data.Origin.Translate),
		Annotations:  []string{},
		Preface:      []string{},
		Popularity:   data.Popularity,
		CacheAt:      strings.TrimSpace(data.CacheAt),
		SourceStatus: "ok",
	}, nil
}

func compactPoemLines(lines []string) []string {
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
