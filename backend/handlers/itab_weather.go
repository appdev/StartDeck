package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	itabWeatherUpstreamBaseURL = "https://base.itab.link/api"
	itabWeatherLocationKey     = "location:default"
	itabWeatherCurrentTTL      = 15 * time.Minute
	itabWeatherLocationTTL     = 15 * time.Minute
	itabWeatherSearchTTL       = 5 * time.Minute
	itabWeatherMaxBody         = 512 * 1024
)

var (
	itabWeatherLocationPattern = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,80}$`)
	itabWeatherTypePattern     = regexp.MustCompile(`^[A-Za-z0-9_-]{1,32}$`)
)

type ItabWeatherLocationData struct {
	Name     string `json:"name"`
	ID       string `json:"id"`
	Adm1     string `json:"adm1,omitempty"`
	Adm2     string `json:"adm2,omitempty"`
	Country  string `json:"country,omitempty"`
	Type     string `json:"type,omitempty"`
	Location string `json:"location,omitempty"`
	IP       string `json:"ip,omitempty"`
}

type ItabWeatherCurrentData struct {
	Status        string `json:"status"`
	Rain          any    `json:"rain,omitempty"`
	Now           any    `json:"now,omitempty"`
	AirNowCity    any    `json:"air_now_city,omitempty"`
	Sun           any    `json:"sun,omitempty"`
	DailyForecast any    `json:"daily_forecast,omitempty"`
}

type ItabWeatherHourlyData struct {
	UpdateTime string `json:"updateTime,omitempty"`
	Hourly     any    `json:"hourly,omitempty"`
}

type ItabWeatherCurrentBundle struct {
	Current      ItabWeatherCurrentData `json:"current"`
	Hourly       ItabWeatherHourlyData  `json:"hourly"`
	SourceStatus string                 `json:"sourceStatus"`
}

type itabWeatherHandlerOptions struct {
	client          *http.Client
	cache           *WidgetCache
	upstreamBaseURL string
}

type itabWeatherEnvelope[T any] struct {
	Code int    `json:"code"`
	Data T      `json:"data"`
	Msg  string `json:"msg"`
}

func GetItabWeatherLocation(c *gin.Context) {
	serveItabWeatherLocationWithOptions(c, itabWeatherHandlerOptions{})
}

func GetItabWeatherSearch(c *gin.Context) {
	serveItabWeatherSearchWithOptions(c, itabWeatherHandlerOptions{})
}

func GetItabWeatherCurrent(c *gin.Context) {
	serveItabWeatherCurrentWithOptions(c, itabWeatherHandlerOptions{})
}

func serveItabWeatherLocationWithOptions(c *gin.Context, options itabWeatherHandlerOptions) {
	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"success": false, "error": "method not allowed"})
		return
	}
	cache := itabWeatherCache(options)
	var cached ItabWeatherLocationData
	hasCache, isFresh, item, err := cache.Get(widgetCacheKindItabWeather, itabWeatherLocationKey, &cached)
	if err == nil && hasCache {
		status := "ok"
		if item != nil && item.SourceStatus != "" {
			status = item.SourceStatus
		}
		if !isFresh {
			status = "stale"
			go refreshItabWeatherLocationAsync(options)
		}
		writeItabWeatherResponse(c, cached, status)
		return
	}
	data, fetchErr := fetchItabWeatherLocation(c.Request.Context(), itabWeatherClient(options), itabWeatherBaseURL(options))
	if fetchErr != nil {
		_ = cache.MarkStatus(widgetCacheKindItabWeather, itabWeatherLocationKey, "error")
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fetchErr.Error()})
		return
	}
	_ = cache.Set(widgetCacheKindItabWeather, itabWeatherLocationKey, data, itabWeatherLocationTTL, "ok")
	writeItabWeatherResponse(c, data, "ok")
}

func serveItabWeatherSearchWithOptions(c *gin.Context, options itabWeatherHandlerOptions) {
	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"success": false, "error": "method not allowed"})
		return
	}
	keyword := strings.TrimSpace(c.Query("keyword"))
	if keyword == "" || len([]rune(keyword)) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid keyword"})
		return
	}
	cacheKey := "search:" + strings.ToLower(keyword)
	cache := itabWeatherCache(options)
	var cached []ItabWeatherLocationData
	hasCache, isFresh, item, err := cache.Get(widgetCacheKindItabWeather, cacheKey, &cached)
	if err == nil && hasCache {
		status := "ok"
		if item != nil && item.SourceStatus != "" {
			status = item.SourceStatus
		}
		if !isFresh {
			status = "stale"
			go refreshItabWeatherSearchAsync(options, keyword, cacheKey)
		}
		writeItabWeatherResponse(c, cached, status)
		return
	}
	data, fetchErr := fetchItabWeatherSearch(c.Request.Context(), itabWeatherClient(options), itabWeatherBaseURL(options), keyword)
	if fetchErr != nil {
		_ = cache.MarkStatus(widgetCacheKindItabWeather, cacheKey, "error")
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fetchErr.Error()})
		return
	}
	_ = cache.Set(widgetCacheKindItabWeather, cacheKey, data, itabWeatherSearchTTL, "ok")
	writeItabWeatherResponse(c, data, "ok")
}

func serveItabWeatherCurrentWithOptions(c *gin.Context, options itabWeatherHandlerOptions) {
	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"success": false, "error": "method not allowed"})
		return
	}
	location := strings.TrimSpace(c.Query("location"))
	locationType := strings.TrimSpace(c.DefaultQuery("type", "city"))
	if !itabWeatherLocationPattern.MatchString(location) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid location"})
		return
	}
	if !itabWeatherTypePattern.MatchString(locationType) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid type"})
		return
	}
	refresh := strings.EqualFold(c.Query("refresh"), "true")
	cacheKey := itabWeatherCurrentCacheKey(location, locationType)
	cache := itabWeatherCache(options)
	var cached ItabWeatherCurrentBundle
	hasCache, isFresh, item, err := cache.Get(widgetCacheKindItabWeather, cacheKey, &cached)
	if err == nil && hasCache && isFresh && !refresh {
		status := "ok"
		if item != nil && item.SourceStatus != "" {
			status = item.SourceStatus
		}
		writeItabWeatherResponse(c, cached, status)
		return
	}
	if err == nil && hasCache && !isFresh && !refresh {
		go refreshItabWeatherCurrentAsync(options, location, locationType, cacheKey)
		writeItabWeatherResponse(c, cached, "stale")
		return
	}

	data, fetchErr := fetchItabWeatherCurrent(c.Request.Context(), itabWeatherClient(options), itabWeatherBaseURL(options), location, locationType)
	if fetchErr != nil {
		_ = cache.MarkStatus(widgetCacheKindItabWeather, cacheKey, "error")
		if hasCache {
			writeItabWeatherResponse(c, cached, "stale")
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fetchErr.Error()})
		return
	}
	_ = cache.Set(widgetCacheKindItabWeather, cacheKey, data, itabWeatherCurrentTTL, "ok")
	writeItabWeatherResponse(c, data, "ok")
}

func refreshItabWeatherLocationAsync(options itabWeatherHandlerOptions) {
	cache := itabWeatherCache(options)
	tag := widgetCacheKindItabWeather + ":" + itabWeatherLocationKey
	if !cache.StartRefresh(tag) {
		return
	}
	defer cache.EndRefresh(tag)
	ctx, cancel := context.WithTimeout(context.Background(), defaultItabResourceTimeout)
	defer cancel()
	data, err := fetchItabWeatherLocation(ctx, itabWeatherClient(options), itabWeatherBaseURL(options))
	if err != nil {
		_ = cache.MarkStatus(widgetCacheKindItabWeather, itabWeatherLocationKey, "error")
		return
	}
	_ = cache.Set(widgetCacheKindItabWeather, itabWeatherLocationKey, data, itabWeatherLocationTTL, "ok")
}

func refreshItabWeatherSearchAsync(options itabWeatherHandlerOptions, keyword, cacheKey string) {
	cache := itabWeatherCache(options)
	tag := widgetCacheKindItabWeather + ":" + cacheKey
	if !cache.StartRefresh(tag) {
		return
	}
	defer cache.EndRefresh(tag)
	ctx, cancel := context.WithTimeout(context.Background(), defaultItabResourceTimeout)
	defer cancel()
	data, err := fetchItabWeatherSearch(ctx, itabWeatherClient(options), itabWeatherBaseURL(options), keyword)
	if err != nil {
		_ = cache.MarkStatus(widgetCacheKindItabWeather, cacheKey, "error")
		return
	}
	_ = cache.Set(widgetCacheKindItabWeather, cacheKey, data, itabWeatherSearchTTL, "ok")
}

func refreshItabWeatherCurrentAsync(options itabWeatherHandlerOptions, location, locationType, cacheKey string) {
	cache := itabWeatherCache(options)
	tag := widgetCacheKindItabWeather + ":" + cacheKey
	if !cache.StartRefresh(tag) {
		return
	}
	defer cache.EndRefresh(tag)
	ctx, cancel := context.WithTimeout(context.Background(), defaultItabResourceTimeout)
	defer cancel()
	data, err := fetchItabWeatherCurrent(ctx, itabWeatherClient(options), itabWeatherBaseURL(options), location, locationType)
	if err != nil {
		_ = cache.MarkStatus(widgetCacheKindItabWeather, cacheKey, "error")
		return
	}
	_ = cache.Set(widgetCacheKindItabWeather, cacheKey, data, itabWeatherCurrentTTL, "ok")
}

func itabWeatherCache(options itabWeatherHandlerOptions) *WidgetCache {
	if options.cache != nil {
		return options.cache
	}
	return sharedWidgetCache
}

func itabWeatherClient(options itabWeatherHandlerOptions) *http.Client {
	if options.client != nil {
		return options.client
	}
	return newItabResourceHTTPClient(false)
}

func itabWeatherBaseURL(options itabWeatherHandlerOptions) string {
	if strings.TrimSpace(options.upstreamBaseURL) != "" {
		return strings.TrimRight(strings.TrimSpace(options.upstreamBaseURL), "/")
	}
	return itabWeatherUpstreamBaseURL
}

func writeItabWeatherResponse(c *gin.Context, data any, status string) {
	if bundle, ok := data.(ItabWeatherCurrentBundle); ok {
		bundle.SourceStatus = status
		data = bundle
	}
	c.Header("Cache-Control", "public, max-age=60, stale-while-revalidate=900")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data, "sourceStatus": status})
}

func itabWeatherCurrentCacheKey(location, locationType string) string {
	return "current:" + strings.ToLower(locationType) + ":" + strings.ToLower(location)
}

func fetchItabWeatherLocation(ctx context.Context, client *http.Client, baseURL string) (ItabWeatherLocationData, error) {
	data, err := fetchItabWeatherAPI[ItabWeatherLocationData](ctx, client, baseURL, "getLocation", nil)
	if err != nil {
		return ItabWeatherLocationData{}, err
	}
	if err := validateItabWeatherLocation(data); err != nil {
		return ItabWeatherLocationData{}, err
	}
	return data, nil
}

func fetchItabWeatherSearch(ctx context.Context, client *http.Client, baseURL, keyword string) ([]ItabWeatherLocationData, error) {
	results, err := fetchItabWeatherAPI[[]ItabWeatherLocationData](ctx, client, baseURL, "weather/city", map[string]string{
		"location": keyword,
	})
	if err != nil {
		return nil, err
	}
	filtered := make([]ItabWeatherLocationData, 0, len(results))
	for _, item := range results {
		if validateItabWeatherLocation(item) == nil {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func fetchItabWeatherCurrent(ctx context.Context, client *http.Client, baseURL, location, locationType string) (ItabWeatherCurrentBundle, error) {
	current, err := fetchItabWeatherAPI[ItabWeatherCurrentData](ctx, client, baseURL, "getWeather", map[string]string{
		"location": location,
		"type":     locationType,
	})
	if err != nil {
		return ItabWeatherCurrentBundle{}, err
	}
	if !strings.EqualFold(current.Status, "ok") {
		return ItabWeatherCurrentBundle{}, errors.New("itab weather status is not ok")
	}
	hourly, err := fetchItabWeatherAPI[ItabWeatherHourlyData](ctx, client, baseURL, "weather/24", map[string]string{
		"location": location,
		"unit":     "m",
	})
	if err != nil {
		return ItabWeatherCurrentBundle{}, err
	}
	return ItabWeatherCurrentBundle{
		Current:      current,
		Hourly:       hourly,
		SourceStatus: "ok",
	}, nil
}

func fetchItabWeatherAPI[T any](ctx context.Context, client *http.Client, baseURL, path string, params map[string]string) (T, error) {
	var zero T
	target, err := buildItabWeatherURL(baseURL, path, params)
	if err != nil {
		return zero, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return zero, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "StartDeck-iTabWeather/1.0")
	resp, err := client.Do(req)
	if err != nil {
		return zero, fmt.Errorf("itab weather fetch failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		return zero, errors.New("itab weather redirect rejected")
	}
	if resp.StatusCode != http.StatusOK {
		return zero, fmt.Errorf("itab weather upstream status rejected: %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, itabWeatherMaxBody+1))
	if err != nil {
		return zero, err
	}
	if int64(len(body)) > itabWeatherMaxBody {
		return zero, errors.New("itab weather response too large")
	}
	var payload itabWeatherEnvelope[T]
	if err := json.Unmarshal(body, &payload); err != nil {
		return zero, errors.New("itab weather malformed json")
	}
	if payload.Code != 200 {
		if strings.TrimSpace(payload.Msg) != "" {
			return zero, errors.New(payload.Msg)
		}
		return zero, errors.New("itab weather response failed")
	}
	return payload.Data, nil
}

func buildItabWeatherURL(baseURL, path string, params map[string]string) (string, error) {
	trimmedBase := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	trimmedPath := strings.TrimLeft(strings.TrimSpace(path), "/")
	if trimmedBase == "" || trimmedPath == "" {
		return "", errors.New("itab weather upstream url missing")
	}
	target, err := url.Parse(trimmedBase + "/" + trimmedPath)
	if err != nil || target.Scheme != "https" || target.Host == "" || target.User != nil {
		return "", errors.New("itab weather upstream url rejected")
	}
	query := target.Query()
	query.Set("lang", "cn")
	for key, value := range params {
		if strings.TrimSpace(value) != "" {
			query.Set(key, value)
		}
	}
	target.RawQuery = query.Encode()
	return target.String(), nil
}

func validateItabWeatherLocation(data ItabWeatherLocationData) error {
	if strings.TrimSpace(data.ID) == "" || strings.TrimSpace(data.Name) == "" {
		return errors.New("itab weather location missing id or name")
	}
	if !itabWeatherLocationPattern.MatchString(data.ID) {
		return errors.New("itab weather location id rejected")
	}
	return nil
}
