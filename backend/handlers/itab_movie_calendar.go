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
	itabMovieCalendarUpstreamURL = "https://api.codelife.cc/itab/todayMovie"
	itabMovieCalendarCacheKey    = "today:v2"
	itabMovieCalendarRefreshTag  = widgetCacheKindItabMovieCalendar + ":" + itabMovieCalendarCacheKey
	itabMovieCalendarTTL         = 6 * time.Hour
	itabMovieCalendarMaxBody     = 128 * 1024
	itabMovieCalendarImageMax    = 2 * 1024 * 1024
)

var itabMovieHexColorPattern = regexp.MustCompile(`^[0-9a-fA-F]{6}$`)

type ItabMovieCalendarData struct {
	Date         string   `json:"date"`
	Day          string   `json:"day"`
	MonthLabel   string   `json:"monthLabel"`
	Weekday      string   `json:"weekday"`
	MovieTitle   string   `json:"movieTitle"`
	Rating       string   `json:"rating"`
	Quote        string   `json:"quote"`
	PosterURL    string   `json:"posterUrl"`
	CoverURL     string   `json:"coverUrl"`
	SourceURL    string   `json:"sourceUrl"`
	Year         string   `json:"year"`
	Area         string   `json:"area"`
	Director     string   `json:"director"`
	Intro        string   `json:"intro"`
	Genres       []string `json:"genres"`
	BgColor      string   `json:"bgColor"`
	TextColor    string   `json:"textColor"`
	SourceStatus string   `json:"sourceStatus"`
}

type itabMovieCalendarHandlerOptions struct {
	client              *http.Client
	cache               *WidgetCache
	upstreamURL         string
	allowUnsafeImageURL bool
	now                 func() time.Time
}

type itabMovieCalendarUpstreamResponse struct {
	Code int                           `json:"code"`
	Data itabMovieCalendarUpstreamData `json:"data"`
	Msg  string                        `json:"msg"`
}

type itabMovieCalendarUpstreamData struct {
	Date      string   `json:"date"`
	Area      string   `json:"mov_area"`
	Director  string   `json:"mov_director"`
	Intro     string   `json:"mov_intro"`
	Link      string   `json:"mov_link"`
	CoverURL  string   `json:"mov_pic"`
	PosterURL string   `json:"poster_url"`
	Rating    string   `json:"mov_rating"`
	Quote     string   `json:"mov_text"`
	Title     string   `json:"mov_title"`
	Genres    []string `json:"mov_type"`
	Year      string   `json:"mov_year"`
	BgColor   string   `json:"bgColor"`
	TextColor string   `json:"color"`
}

func GetItabMovieCalendar(c *gin.Context) {
	serveItabMovieCalendarWithOptions(c, itabMovieCalendarHandlerOptions{})
}

func GetItabMovieCalendarImage(c *gin.Context) {
	serveItabMovieCalendarImageWithOptions(c, itabMovieCalendarHandlerOptions{})
}

func serveItabMovieCalendarWithOptions(c *gin.Context, options itabMovieCalendarHandlerOptions) {
	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"success": false, "error": "method not allowed"})
		return
	}

	cache := itabMovieCalendarCache(options)
	var cached ItabMovieCalendarData
	hasCache, isFresh, item, err := cache.Get(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, &cached)
	if err == nil && hasCache {
		status := "ok"
		if item != nil && item.SourceStatus != "" {
			status = item.SourceStatus
		}
		if isFresh {
			writeItabMovieCalendarResponse(c, cached, status)
			return
		}

		if itabMovieCalendarDateIsCurrent(cached.Date, options) {
			go refreshItabMovieCalendarAsync(options)
			writeItabMovieCalendarResponse(c, cached, "stale")
			return
		}

		data, fetchErr := fetchItabMovieCalendar(c.Request.Context(), itabMovieCalendarClient(options), itabMovieCalendarUpstream(options))
		if fetchErr == nil {
			_ = cache.Set(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, data, itabMovieCalendarTTL, "ok")
			writeItabMovieCalendarResponse(c, data, "ok")
			return
		}
		_ = cache.MarkStatus(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, "error")
		writeItabMovieCalendarResponse(c, cached, "stale")
		return
	}

	data, fetchErr := fetchItabMovieCalendar(c.Request.Context(), itabMovieCalendarClient(options), itabMovieCalendarUpstream(options))
	if fetchErr != nil {
		_ = cache.MarkStatus(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, "error")
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fetchErr.Error()})
		return
	}
	_ = cache.Set(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, data, itabMovieCalendarTTL, "ok")
	writeItabMovieCalendarResponse(c, data, "ok")
}

func refreshItabMovieCalendarAsync(options itabMovieCalendarHandlerOptions) {
	cache := itabMovieCalendarCache(options)
	if !cache.StartRefresh(itabMovieCalendarRefreshTag) {
		return
	}
	defer cache.EndRefresh(itabMovieCalendarRefreshTag)

	ctx, cancel := context.WithTimeout(context.Background(), defaultItabResourceTimeout)
	defer cancel()
	data, err := fetchItabMovieCalendar(ctx, itabMovieCalendarClient(options), itabMovieCalendarUpstream(options))
	if err != nil {
		_ = cache.MarkStatus(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, "error")
		return
	}
	_ = cache.Set(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, data, itabMovieCalendarTTL, "ok")
}

func itabMovieCalendarCache(options itabMovieCalendarHandlerOptions) *WidgetCache {
	if options.cache != nil {
		return options.cache
	}
	return sharedWidgetCache
}

func itabMovieCalendarClient(options itabMovieCalendarHandlerOptions) *http.Client {
	if options.client != nil {
		return options.client
	}
	return newItabResourceHTTPClient(false)
}

func itabMovieCalendarUpstream(options itabMovieCalendarHandlerOptions) string {
	if strings.TrimSpace(options.upstreamURL) != "" {
		return strings.TrimSpace(options.upstreamURL)
	}
	return itabMovieCalendarUpstreamURL
}

func itabMovieCalendarNow(options itabMovieCalendarHandlerOptions) time.Time {
	if options.now != nil {
		return options.now()
	}
	return time.Now()
}

func itabMovieCalendarDateIsCurrent(date string, options itabMovieCalendarHandlerOptions) bool {
	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		location = time.FixedZone("CST", 8*60*60)
	}
	return strings.TrimSpace(date) == itabMovieCalendarNow(options).In(location).Format("2006-01-02")
}

func writeItabMovieCalendarResponse(c *gin.Context, data ItabMovieCalendarData, status string) {
	data.SourceStatus = status
	if data.PosterURL != "" {
		data.PosterURL = itabMovieCalendarImagePath("poster")
	}
	if data.CoverURL != "" {
		data.CoverURL = itabMovieCalendarImagePath("cover")
	}
	c.Header("Cache-Control", "public, max-age=300, stale-while-revalidate=21600")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func serveItabMovieCalendarImageWithOptions(c *gin.Context, options itabMovieCalendarHandlerOptions) {
	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "method not allowed"})
		return
	}
	kind := strings.TrimSpace(c.Param("kind"))
	if kind != "poster" && kind != "cover" {
		c.JSON(http.StatusNotFound, gin.H{"error": "movie calendar image not found"})
		return
	}
	data, err := currentItabMovieCalendarData(c.Request.Context(), options)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	targetURL := data.CoverURL
	if kind == "poster" {
		targetURL = data.PosterURL
	}
	if targetURL == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "movie calendar image not found"})
		return
	}
	if !options.allowUnsafeImageURL && sanitizeItabMovieURL(targetURL, "files.codelife.cc") == "" {
		c.JSON(http.StatusBadGateway, gin.H{"error": "movie calendar image url rejected"})
		return
	}
	target, err := url.Parse(targetURL)
	if err != nil || target.Scheme != "https" || target.Host == "" || target.User != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "movie calendar image url rejected"})
		return
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, target.String(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "request build failed"})
		return
	}
	req.Header.Set("Accept", "image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1")
	req.Header.Set("User-Agent", "StartDeck-iTabMovieCalendar/1.0")
	resp, err := itabMovieCalendarClient(options).Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "movie calendar image fetch failed"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "movie calendar image redirect rejected"})
		return
	}
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "movie calendar image status rejected"})
		return
	}
	contentType := strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0])
	if !isAllowedContentType(contentType, []string{"image/webp", "image/png", "image/jpeg", "image/avif"}) {
		c.JSON(http.StatusBadGateway, gin.H{"error": "movie calendar image type rejected"})
		return
	}
	if resp.ContentLength > itabMovieCalendarImageMax {
		c.JSON(http.StatusBadGateway, gin.H{"error": "movie calendar image too large"})
		return
	}
	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
	reader := io.LimitReader(resp.Body, itabMovieCalendarImageMax+1)
	written, err := io.Copy(c.Writer, reader)
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}
	if written > itabMovieCalendarImageMax {
		c.Status(http.StatusBadGateway)
	}
}

func currentItabMovieCalendarData(ctx context.Context, options itabMovieCalendarHandlerOptions) (ItabMovieCalendarData, error) {
	cache := itabMovieCalendarCache(options)
	var cached ItabMovieCalendarData
	hasCache, _, _, err := cache.Get(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, &cached)
	if err == nil && hasCache && itabMovieCalendarDateIsCurrent(cached.Date, options) {
		return cached, nil
	}
	data, fetchErr := fetchItabMovieCalendar(ctx, itabMovieCalendarClient(options), itabMovieCalendarUpstream(options))
	if fetchErr != nil {
		if err == nil && hasCache {
			return cached, nil
		}
		return ItabMovieCalendarData{}, fetchErr
	}
	_ = cache.Set(widgetCacheKindItabMovieCalendar, itabMovieCalendarCacheKey, data, itabMovieCalendarTTL, "ok")
	return data, nil
}

func itabMovieCalendarImagePath(kind string) string {
	return "/api/itab/movie-calendar/image/" + kind
}

func fetchItabMovieCalendar(ctx context.Context, client *http.Client, upstream string) (ItabMovieCalendarData, error) {
	if client == nil {
		client = newItabResourceHTTPClient(false)
	}
	req, err := buildItabMovieCalendarRequest(ctx, upstream)
	if err != nil {
		return ItabMovieCalendarData{}, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return ItabMovieCalendarData{}, fmt.Errorf("movie calendar upstream fetch failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ItabMovieCalendarData{}, fmt.Errorf("movie calendar upstream status rejected: %d", resp.StatusCode)
	}

	var payload itabMovieCalendarUpstreamResponse
	decoder := json.NewDecoder(io.LimitReader(resp.Body, itabMovieCalendarMaxBody))
	if err := decoder.Decode(&payload); err != nil {
		return ItabMovieCalendarData{}, fmt.Errorf("movie calendar upstream json rejected: %w", err)
	}
	if payload.Code != http.StatusOK {
		if strings.TrimSpace(payload.Msg) != "" {
			return ItabMovieCalendarData{}, errors.New(payload.Msg)
		}
		return ItabMovieCalendarData{}, fmt.Errorf("movie calendar upstream code rejected: %d", payload.Code)
	}
	return normalizeItabMovieCalendar(payload.Data)
}

func buildItabMovieCalendarRequest(ctx context.Context, upstream string) (*http.Request, error) {
	parsed, err := url.Parse(strings.TrimSpace(upstream))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return nil, errors.New("movie calendar upstream url rejected")
	}
	query := parsed.Query()
	if strings.TrimSpace(query.Get("version")) == "" {
		query.Set("version", "v2")
	}
	parsed.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "StartDeck-iTabMovieCalendar/1.0")
	return req, nil
}

func normalizeItabMovieCalendar(data itabMovieCalendarUpstreamData) (ItabMovieCalendarData, error) {
	title := strings.TrimSpace(data.Title)
	if title == "" {
		return ItabMovieCalendarData{}, errors.New("movie calendar title missing")
	}
	quote := strings.TrimSpace(data.Quote)
	intro := strings.TrimSpace(data.Intro)
	if quote == "" {
		quote = intro
	}
	date, day, monthLabel, weekday := normalizeItabMovieCalendarDate(data.Date)
	return ItabMovieCalendarData{
		Date:       date,
		Day:        day,
		MonthLabel: monthLabel,
		Weekday:    weekday,
		MovieTitle: title,
		Rating:     fallbackTrim(data.Rating, "--"),
		Quote:      quote,
		PosterURL:  sanitizeItabMovieURL(data.PosterURL, "files.codelife.cc"),
		CoverURL:   sanitizeItabMovieURL(data.CoverURL, "files.codelife.cc"),
		SourceURL:  sanitizeItabMovieURL(data.Link, "movie.douban.com"),
		Year:       strings.TrimSpace(data.Year),
		Area:       strings.TrimSpace(data.Area),
		Director:   strings.TrimSpace(data.Director),
		Intro:      intro,
		Genres:     normalizeItabMovieGenres(data.Genres),
		BgColor:    normalizeItabMovieColor(data.BgColor, "4c4c3f"),
		TextColor:  normalizeItabMovieColor(data.TextColor, "f9f9f4"),
	}, nil
}

func normalizeItabMovieCalendarDate(value string) (string, string, string, string) {
	parsed, err := time.Parse("20060102", strings.TrimSpace(value))
	if err != nil {
		parsed = time.Now()
	}
	weekdays := []string{"周日", "周一", "周二", "周三", "周四", "周五", "周六"}
	return parsed.Format("2006-01-02"),
		fmt.Sprintf("%d", parsed.Day()),
		fmt.Sprintf("%d月", int(parsed.Month())),
		weekdays[int(parsed.Weekday())]
}

func normalizeItabMovieGenres(values []string) []string {
	genres := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		genres = append(genres, trimmed)
	}
	return genres
}

func normalizeItabMovieColor(value, fallback string) string {
	trimmed := strings.TrimPrefix(strings.TrimSpace(value), "#")
	if itabMovieHexColorPattern.MatchString(trimmed) {
		return strings.ToLower(trimmed)
	}
	return fallback
}

func sanitizeItabMovieURL(raw string, allowedHosts ...string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return ""
	}
	host := strings.ToLower(parsed.Hostname())
	for _, allowed := range allowedHosts {
		if host == strings.ToLower(allowed) {
			return parsed.String()
		}
	}
	return ""
}

func fallbackTrim(value, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}
