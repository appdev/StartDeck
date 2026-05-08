package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	defaultAddr         = ":8080"
	defaultIconPrefix   = "/icons/"
	defaultCacheName    = "cache.json"
	defaultConfigPath   = "./config.json"
	defaultSeedName     = "seed-data.json"
	defaultITabOrigin   = "https://go.itab.link"
	defaultITabAPI      = "https://base.itab.link/website/info?lang=cn&url=%s"
	defaultMicrolinkAPI = "https://api.microlink.io/"
	defaultUserAgent    = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
	cacheRefreshTTL     = 30 * 24 * time.Hour
)

type seedFile struct {
	Items []seedItem `json:"items"`
}

type seedItem struct {
	Title           string `json:"title"`
	URL             string `json:"url"`
	IconURL         string `json:"icon_url"`
	OriginalIconURL string `json:"original_icon_url"`
	BackgroundColor string `json:"background_color"`
	IconLocalHost   string `json:"icon_local_host"`
	Update          bool   `json:"update,omitempty"`
}

type cacheFile struct {
	UpdatedAt time.Time     `json:"updated_at"`
	Records   []*iconRecord `json:"records"`
}

type iconRecord struct {
	Host            string    `json:"host"`
	Title           string    `json:"title"`
	Name            string    `json:"name"`
	URL             string    `json:"url"`
	FinalURL        string    `json:"finalUrl"`
	Description     string    `json:"description"`
	BackgroundColor string    `json:"backgroundColor"`
	Icons           []string  `json:"icons"`
	Src             string    `json:"src"`
	LocalIcons      []string  `json:"localIcons"`
	Source          string    `json:"source"`
	FetchedAt       time.Time `json:"fetchedAt"`
	UpdatedAt       time.Time `json:"updatedAt,omitempty"`
}

type responseBody struct {
	Code int           `json:"code"`
	Data *responseData `json:"data"`
	Msg  string        `json:"msg"`
}

type responseData struct {
	URL             *string `json:"url"`
	Title           *string `json:"title"`
	Icon            *string `json:"icon"`
	Description     *string `json:"description"`
	BackgroundColor *string `json:"backgroundColor"`
	FetchedAt       *string `json:"fetchedAt"`
}

type pageMetadata struct {
	FinalURL    string
	Title       string
	IconURL     string
	Description string
}

type responseRecorder struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int
}

type requestTrace struct {
	id           string
	startedAt    time.Time
	method       string
	path         string
	remoteAddr   string
	forwardedFor string
	userAgent    string
}

type metadataLookupDebug struct {
	FinalURL        string
	HTMLFound       bool
	HTMLError       string
	IconResolution  string
	IconError       string
	HasRecord       bool
	HasIcon         bool
	HasDescription  bool
	BackgroundColor string
	Title           string
}

type itabInfoResponse struct {
	Code int          `json:"code"`
	Data itabInfoData `json:"data"`
	Msg  string       `json:"msg"`
}

type itabInfoData struct {
	Name            string   `json:"name"`
	Icon            []string `json:"icon"`
	URL             string   `json:"url"`
	Src             string   `json:"src"`
	ImgSrc          string   `json:"imgSrc"`
	BackgroundColor string   `json:"backgroundColor"`
}

type app struct {
	mu                sync.RWMutex
	seedData          *seedFile
	seedItems         map[string]*seedItem
	seedRecords       map[string]*iconRecord
	cacheRecords      map[string]*iconRecord
	cachePath         string
	seedPath          string
	seedIconDir       string
	cacheIconDir      string
	iconPrefix        string
	cachePrefix       string
	publicIconBaseURL string
	client            *http.Client
	itabClient        *itabClient
	microlinkClient   *microlinkClient
}

type itabClient struct {
	client       *http.Client
	fp           string
	signatureKey string
	token        string
}

type microlinkClient struct {
	client  *http.Client
	baseURL string
	apiKey  string
}

type serviceConfig struct {
	Addr              string `json:"addr"`
	DataDir           string `json:"dataDir"`
	SeedIconDir       string `json:"seedIconDir"`
	CacheIconDir      string `json:"cacheIconDir"`
	CacheFile         string `json:"cacheFile"`
	SeedJSON          string `json:"seedJSON"`
	IconPrefix        string `json:"iconPrefix"`
	CachePrefix       string `json:"cachePrefix"`
	PublicIconBaseURL string `json:"publicIconBaseURL"`
	ITabFP            string `json:"itabFP"`
	ITabSignatureKey  string `json:"itabSignatureKey"`
	ITabToken         string `json:"itabToken"`
	MicrolinkBaseURL  string `json:"microlinkBaseURL"`
	MicrolinkAPIKey   string `json:"microlinkAPIKey"`
}

type microlinkLookupResponse struct {
	Status  string        `json:"status"`
	Message string        `json:"message"`
	Data    microlinkData `json:"data"`
}

type microlinkData struct {
	URL         string          `json:"url"`
	Title       string          `json:"title"`
	Publisher   string          `json:"publisher"`
	Description string          `json:"description"`
	Logo        *microlinkAsset `json:"logo"`
	Image       *microlinkAsset `json:"image"`
}

type microlinkAsset struct {
	URL              string   `json:"url"`
	BackgroundColor  string   `json:"background_color"`
	Color            string   `json:"color"`
	AlternativeColor string   `json:"alternative_color"`
	Palette          []string `json:"palette"`
}

type seedSupplement struct {
	Title           string
	OriginalIconURL string
	BackgroundColor string
}

var (
	titleTagPattern = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
	metaTagPattern  = regexp.MustCompile(`(?is)<meta\b[^>]*>`)
	linkTagPattern  = regexp.MustCompile(`(?is)<link\b[^>]*>`)
	attrPattern     = regexp.MustCompile(`(?is)([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`)
	requestSeq      uint64
)

func main() {
	configPath := env("CONFIG_FILE", defaultConfigPath)
	cfg, err := loadConfig(configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	if err := os.MkdirAll(cfg.SeedIconDir, 0o755); err != nil {
		log.Fatalf("create seed icon dir: %v", err)
	}
	if err := os.MkdirAll(cfg.CacheIconDir, 0o755); err != nil {
		log.Fatalf("create cache icon dir: %v", err)
	}
	if err := os.MkdirAll(filepath.Dir(cfg.CacheFile), 0o755); err != nil {
		log.Fatalf("create cache dir: %v", err)
	}

	httpClient := &http.Client{Timeout: 20 * time.Second}
	application := &app{
		seedItems:         make(map[string]*seedItem),
		seedRecords:       make(map[string]*iconRecord),
		cacheRecords:      make(map[string]*iconRecord),
		cachePath:         cfg.CacheFile,
		seedPath:          cfg.SeedJSON,
		seedIconDir:       cfg.SeedIconDir,
		cacheIconDir:      cfg.CacheIconDir,
		iconPrefix:        ensureLeadingTrailingSlash(cfg.IconPrefix),
		cachePrefix:       ensureLeadingTrailingSlash(cfg.CachePrefix),
		publicIconBaseURL: strings.TrimRight(cfg.PublicIconBaseURL, "/"),
		client:            httpClient,
		itabClient: &itabClient{
			client:       httpClient,
			fp:           cfg.ITabFP,
			signatureKey: cfg.ITabSignatureKey,
			token:        cfg.ITabToken,
		},
		microlinkClient: &microlinkClient{
			client:  httpClient,
			baseURL: strings.TrimSpace(cfg.MicrolinkBaseURL),
			apiKey:  strings.TrimSpace(cfg.MicrolinkAPIKey),
		},
	}

	if err := application.load(); err != nil {
		log.Fatalf("load cache: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle(application.iconPrefix, http.StripPrefix(application.iconPrefix, http.FileServer(http.Dir(application.seedIconDir))))
	mux.Handle(application.cachePrefix, http.StripPrefix(application.cachePrefix, http.FileServer(http.Dir(application.cacheIconDir))))
	mux.HandleFunc("/api/icon", application.handleLookup)
	mux.HandleFunc("/api/site/metadata", application.handleSiteMetadata)
	mux.HandleFunc("/api/icon/refresh", application.handleRefresh)
	mux.HandleFunc("/api/icon/cache", application.handleDeleteCache)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, responseBody{Code: 200, Msg: "ok"})
	})

	log.Printf("icon service listening on %s", cfg.Addr)
	log.Printf("icon public base: %s", firstNonEmpty(application.publicIconBaseURL, "(request derived)"))
	if err := http.ListenAndServe(cfg.Addr, mux); err != nil {
		log.Fatal(err)
	}
}

func (a *app) load() error {
	if err := a.importSeed(); err != nil {
		return err
	}
	if _, err := os.Stat(a.cachePath); err == nil {
		return a.loadCache()
	}
	return nil
}

func (a *app) loadCache() error {
	data, err := os.ReadFile(a.cachePath)
	if err != nil {
		return err
	}
	var cache cacheFile
	if err := json.Unmarshal(data, &cache); err != nil {
		return err
	}
	pruned := false
	migrated := false
	for _, record := range cache.Records {
		if strings.EqualFold(strings.TrimSpace(record.Source), "seed") {
			pruned = true
			continue
		}
		if record.FetchedAt.IsZero() && !record.UpdatedAt.IsZero() {
			record.FetchedAt = record.UpdatedAt
			record.UpdatedAt = time.Time{}
			migrated = true
		}
		a.cacheRecords[record.Host] = record
	}
	if pruned || migrated {
		return a.save()
	}
	return nil
}

func (a *app) importSeed() error {
	data, err := os.ReadFile(a.seedPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}

	var seed seedFile
	if err := json.Unmarshal(data, &seed); err != nil {
		return err
	}

	a.mu.Lock()
	a.seedData = &seed
	a.seedItems = make(map[string]*seedItem)
	a.seedRecords = make(map[string]*iconRecord)
	a.mu.Unlock()

	for index := range seed.Items {
		item := &seed.Items[index]
		host := normalizeHost(item.URL)
		if host == "" {
			continue
		}

		a.mu.RLock()
		_, exists := a.seedRecords[host]
		a.mu.RUnlock()
		if exists {
			continue
		}

		record := a.buildSeedRecord(item, time.Now().UTC())
		a.mu.Lock()
		a.seedItems[host] = item
		a.seedRecords[host] = record
		a.mu.Unlock()
	}

	return nil
}

func (a *app) buildSeedRecord(item *seedItem, fetchedAt time.Time) *iconRecord {
	host := normalizeHost(item.URL)
	if host == "" {
		return nil
	}

	record := &iconRecord{
		Host:            host,
		Title:           strings.TrimSpace(item.Title),
		Name:            firstNonEmpty(strings.TrimSpace(item.Title), host),
		URL:             strings.TrimSpace(item.URL),
		FinalURL:        strings.TrimSpace(item.URL),
		Description:     "",
		BackgroundColor: strings.TrimSpace(item.BackgroundColor),
		Icons:           compactStrings([]string{firstNonEmpty(strings.TrimSpace(item.OriginalIconURL), strings.TrimSpace(item.IconURL))}),
		Src:             firstNonEmpty(strings.TrimSpace(item.OriginalIconURL), strings.TrimSpace(item.IconURL)),
		Source:          "seed",
		FetchedAt:       fetchedAt,
	}
	record.LocalIcons = a.resolveSeedLocalIcons(item)
	return record
}

func (a *app) resolveSeedLocalIcons(item *seedItem) []string {
	if item == nil {
		return nil
	}

	localIcon := strings.TrimSpace(item.IconURL)
	if localIcon == "" {
		return nil
	}

	localIcon = resolveSeedAssetPath(a.seedPath, localIcon)
	if !fileExists(localIcon) {
		return nil
	}

	fileName := filepath.Base(localIcon)
	target := filepath.Join(a.seedIconDir, fileName)
	if samePath(localIcon, target) {
		return []string{fileName}
	}
	if err := copyFile(localIcon, target); err == nil {
		return []string{fileName}
	}
	return nil
}

func applySeedSupplement(item *seedItem, supplement *seedSupplement) bool {
	if item == nil || supplement == nil {
		return false
	}

	changed := false
	if strings.TrimSpace(item.Title) == "" && strings.TrimSpace(supplement.Title) != "" {
		item.Title = strings.TrimSpace(supplement.Title)
		changed = true
	}
	if strings.TrimSpace(item.OriginalIconURL) == "" && strings.TrimSpace(supplement.OriginalIconURL) != "" {
		item.OriginalIconURL = strings.TrimSpace(supplement.OriginalIconURL)
		changed = true
	}
	if strings.TrimSpace(item.BackgroundColor) == "" && strings.TrimSpace(supplement.BackgroundColor) != "" {
		item.BackgroundColor = strings.TrimSpace(supplement.BackgroundColor)
		changed = true
	}
	return changed
}

func (a *app) ensureSeedRecordCompleted(ctx context.Context, host string) (*iconRecord, error) {
	a.mu.RLock()
	item := a.seedItems[host]
	record := a.seedRecords[host]
	if item == nil || record == nil || item.Update || !seedItemNeedsCompletion(item) {
		a.mu.RUnlock()
		return record, nil
	}
	lookupURL := strings.TrimSpace(item.URL)
	a.mu.RUnlock()

	supplement, err := a.lookupSeedSupplement(ctx, lookupURL)
	if err != nil {
		return record, err
	}
	if supplement == nil {
		return record, errors.New("seed completion result is empty")
	}

	a.mu.Lock()
	item = a.seedItems[host]
	record = a.seedRecords[host]
	if item == nil || record == nil || item.Update || !seedItemNeedsCompletion(item) {
		a.mu.Unlock()
		return record, nil
	}

	changed := applySeedSupplement(item, supplement)
	if seedItemNeedsCompletion(item) && !item.Update {
		item.Update = true
		changed = true
	}
	if changed {
		a.seedRecords[host] = a.buildSeedRecord(item, time.Now().UTC())
		record = a.seedRecords[host]
		if err := writeSeedFile(a.seedPath, a.seedData); err != nil {
			log.Printf("save seed updates: %v", err)
		}
	}
	a.mu.Unlock()
	return record, nil
}

func (a *app) lookupSeedSupplement(ctx context.Context, rawInput string) (*seedSupplement, error) {
	targets := candidateURLs(rawInput)
	var lastErr error

	if a.microlinkClient != nil && strings.TrimSpace(a.microlinkClient.baseURL) != "" {
		for _, target := range targets {
			info, err := a.microlinkClient.lookup(ctx, target)
			if err != nil {
				lastErr = err
				continue
			}
			supplement := seedSupplementFromMicrolink(info)
			if seedSupplementHasData(supplement) {
				return supplement, nil
			}
			lastErr = errors.New("microlink seed supplement is empty")
		}
	}

	if a.itabClient != nil && a.itabClient.client != nil {
		for _, target := range targets {
			info, err := a.itabClient.lookup(ctx, target)
			if err != nil {
				lastErr = err
				continue
			}
			supplement := seedSupplementFromITab(info)
			if seedSupplementHasData(supplement) {
				return supplement, nil
			}
			lastErr = errors.New("itab seed supplement is empty")
		}
	}

	if lastErr == nil {
		lastErr = errors.New("seed completion lookup failed")
	}
	return nil, lastErr
}

func (a *app) handleLookup(w http.ResponseWriter, r *http.Request) {
	trace := newRequestTrace(r)
	recorder := &responseRecorder{ResponseWriter: w}
	recorder.Header().Set("X-Request-Id", trace.id)
	trace.log("request_start", map[string]any{
		"queryHost": trimLogValue(r.URL.Query().Get("host"), 240),
		"queryURL":  trimLogValue(r.URL.Query().Get("url"), 240),
	})
	defer func() {
		trace.log("request_complete", map[string]any{
			"statusCode":    recorder.StatusCode(),
			"responseBytes": recorder.bytesWritten,
			"durationMs":    time.Since(trace.startedAt).Milliseconds(),
			"contextError":  errorText(r.Context().Err()),
		})
	}()

	if r.Method != http.MethodGet {
		trace.log("validation_error", map[string]any{"reason": "method_not_allowed"})
		writeJSON(recorder, http.StatusMethodNotAllowed, responseBody{Code: 405, Msg: "method not allowed"})
		return
	}

	query := strings.TrimSpace(r.URL.Query().Get("host"))
	if query == "" {
		query = strings.TrimSpace(r.URL.Query().Get("url"))
	}
	if query == "" {
		trace.log("validation_error", map[string]any{"reason": "missing_host"})
		writeJSON(recorder, http.StatusBadRequest, responseBody{Code: 400, Msg: "host 参数不能为空"})
		return
	}

	host := normalizeHost(query)
	if host == "" {
		trace.log("validation_error", map[string]any{
			"reason": "invalid_host",
			"query":  trimLogValue(query, 240),
		})
		writeJSON(recorder, http.StatusBadRequest, responseBody{Code: 400, Msg: "host 参数格式无效"})
		return
	}

	record, resolution, err := a.lookupOrFetchRecord(r.Context(), query)
	if err != nil {
		trace.log("lookup_error", map[string]any{
			"query":      trimLogValue(query, 240),
			"host":       host,
			"resolution": resolution,
			"error":      err.Error(),
		})
		writeJSON(recorder, http.StatusBadGateway, responseBody{Code: 502, Msg: err.Error()})
		return
	}

	trace.log("lookup_result", map[string]any{
		"query":           trimLogValue(query, 240),
		"host":            host,
		"resolution":      resolution,
		"source":          trimLogValue(record.Source, 32),
		"title":           trimLogValue(firstNonEmpty(record.Title, record.Name), 120),
		"hasLocalIcons":   len(record.LocalIcons) > 0,
		"hasRemoteIcons":  len(record.Icons) > 0,
		"backgroundColor": trimLogValue(record.BackgroundColor, 32),
		"fetchedAt":       recordTimestamp(record).UTC().Format(time.RFC3339),
	})

	writeJSON(recorder, http.StatusOK, responseBody{
		Code: 200,
		Data: a.toResponse(r, record),
		Msg:  "ok",
	})
}

func (a *app) handleSiteMetadata(w http.ResponseWriter, r *http.Request) {
	trace := newRequestTrace(r)
	recorder := &responseRecorder{ResponseWriter: w}
	recorder.Header().Set("X-Request-Id", trace.id)
	trace.log("request_start", map[string]any{
		"queryURL": trimLogValue(r.URL.Query().Get("url"), 240),
	})
	defer func() {
		trace.log("request_complete", map[string]any{
			"statusCode":    recorder.StatusCode(),
			"responseBytes": recorder.bytesWritten,
			"durationMs":    time.Since(trace.startedAt).Milliseconds(),
			"contextError":  errorText(r.Context().Err()),
		})
	}()

	if r.Method != http.MethodGet {
		trace.log("validation_error", map[string]any{"reason": "method_not_allowed"})
		writeJSON(recorder, http.StatusMethodNotAllowed, responseBody{Code: 405, Msg: "method not allowed"})
		return
	}

	inputURL := strings.TrimSpace(r.URL.Query().Get("url"))
	if inputURL == "" {
		trace.log("validation_error", map[string]any{"reason": "missing_url"})
		writeJSON(recorder, http.StatusBadRequest, responseBody{Code: 400, Msg: "Missing url query parameter"})
		return
	}

	normalizedURL := normalizeLookupURL(inputURL)
	if normalizedURL == "" {
		trace.log("validation_error", map[string]any{
			"reason": "invalid_url",
			"input":  trimLogValue(inputURL, 240),
		})
		writeJSON(recorder, http.StatusBadRequest, responseBody{Code: 400, Msg: "Invalid url query parameter"})
		return
	}

	metadata, debug, err := a.resolveSiteMetadata(r.Context(), r, normalizedURL)
	if err != nil {
		trace.log("site_metadata_error", map[string]any{
			"inputURL":       trimLogValue(inputURL, 240),
			"normalizedURL":  trimLogValue(normalizedURL, 240),
			"finalURL":       trimLogValue(debug.FinalURL, 240),
			"htmlFound":      debug.HTMLFound,
			"htmlError":      trimLogValue(debug.HTMLError, 200),
			"iconResolution": debug.IconResolution,
			"iconError":      trimLogValue(debug.IconError, 200),
			"error":          err.Error(),
		})
		writeJSON(recorder, http.StatusBadGateway, responseBody{Code: 502, Msg: err.Error()})
		return
	}

	trace.log("site_metadata_result", map[string]any{
		"inputURL":        trimLogValue(inputURL, 240),
		"normalizedURL":   trimLogValue(normalizedURL, 240),
		"finalURL":        trimLogValue(debug.FinalURL, 240),
		"htmlFound":       debug.HTMLFound,
		"htmlError":       trimLogValue(debug.HTMLError, 200),
		"iconResolution":  debug.IconResolution,
		"iconError":       trimLogValue(debug.IconError, 200),
		"hasRecord":       debug.HasRecord,
		"hasIcon":         debug.HasIcon,
		"hasDescription":  debug.HasDescription,
		"title":           trimLogValue(debug.Title, 120),
		"backgroundColor": trimLogValue(debug.BackgroundColor, 32),
	})

	writeJSON(recorder, http.StatusOK, responseBody{
		Code: 200,
		Data: metadata,
		Msg:  "ok",
	})
}

func (a *app) handleRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, responseBody{Code: 405, Msg: "method not allowed"})
		return
	}

	query, host, err := lookupInput(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, responseBody{Code: 400, Msg: err.Error()})
		return
	}

	if a.isSeedHost(host) {
		writeJSON(w, http.StatusBadRequest, responseBody{Code: 400, Msg: "默认数据不支持强制刷新"})
		return
	}

	record, err := a.fetchAndCache(r.Context(), query)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, responseBody{Code: 502, Msg: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, responseBody{
		Code: 200,
		Data: a.toResponse(r, record),
		Msg:  fmt.Sprintf("已刷新 %s", host),
	})
}

func (a *app) handleDeleteCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, responseBody{Code: 405, Msg: "method not allowed"})
		return
	}

	_, host, err := lookupInput(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, responseBody{Code: 400, Msg: err.Error()})
		return
	}

	deleted, fallback, err := a.deleteCacheRecord(host)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, responseBody{Code: 500, Msg: err.Error()})
		return
	}
	if !deleted {
		writeJSON(w, http.StatusNotFound, responseBody{Code: 404, Msg: "指定 host 没有缓存数据"})
		return
	}

	msg := fmt.Sprintf("已删除 %s 的缓存数据", host)
	if fallback != nil {
		msg += "，当前已回退到默认数据"
	}
	writeJSON(w, http.StatusOK, responseBody{
		Code: 200,
		Data: a.toResponse(r, fallback),
		Msg:  msg,
	})
}

func (a *app) fetchAndCache(ctx context.Context, rawInput string) (*iconRecord, error) {
	targets := candidateURLs(rawInput)
	var lastErr error

	if a.microlinkClient != nil && strings.TrimSpace(a.microlinkClient.baseURL) != "" {
		for _, target := range targets {
			info, err := a.microlinkClient.lookup(ctx, target)
			if err != nil {
				lastErr = err
				continue
			}
			record, err := a.cacheMicrolinkInfo(target, info)
			if err != nil {
				lastErr = err
				continue
			}
			return record, nil
		}
	}

	for _, target := range targets {
		info, err := a.itabClient.lookup(ctx, target)
		if err != nil {
			lastErr = err
			continue
		}
		record, err := a.cacheRemoteInfo(target, info)
		if err != nil {
			lastErr = err
			continue
		}
		return record, nil
	}

	if lastErr == nil {
		lastErr = errors.New("未命中且回源查询失败")
	}
	return nil, lastErr
}

func (a *app) cacheRemoteInfo(rawInput string, info *itabInfoData) (*iconRecord, error) {
	targetURL := firstNonEmpty(strings.TrimSpace(info.URL), normalizeLookupURL(rawInput))
	host := normalizeHost(firstNonEmpty(targetURL, rawInput))
	if host == "" {
		return nil, errors.New("回源结果缺少有效 host")
	}

	record := &iconRecord{
		Host:            host,
		Title:           strings.TrimSpace(info.Name),
		Name:            strings.TrimSpace(info.Name),
		URL:             firstNonEmpty(targetURL, normalizeLookupURL(rawInput)),
		FinalURL:        firstNonEmpty(targetURL, normalizeLookupURL(rawInput)),
		Description:     "",
		BackgroundColor: strings.TrimSpace(info.BackgroundColor),
		Icons:           compactStrings(append(info.Icon, strings.TrimSpace(info.ImgSrc), strings.TrimSpace(info.Src))),
		Src:             firstNonEmpty(strings.TrimSpace(info.Src), strings.TrimSpace(info.ImgSrc), firstString(info.Icon)),
		Source:          "itab",
		FetchedAt:       time.Now().UTC(),
	}

	files, err := a.downloadIcons(host, record.Icons)
	if err != nil {
		return nil, err
	}
	record.LocalIcons = files

	a.mu.Lock()
	a.cacheRecords[host] = record
	a.mu.Unlock()

	if err := a.save(); err != nil {
		return nil, err
	}
	return record, nil
}

func (a *app) cacheMicrolinkInfo(rawInput string, info *microlinkData) (*iconRecord, error) {
	targetURL := firstNonEmpty(strings.TrimSpace(info.URL), normalizeLookupURL(rawInput))
	host := normalizeHost(firstNonEmpty(targetURL, rawInput))
	if host == "" {
		return nil, errors.New("microlink 结果缺少有效 host")
	}

	icons := compactStrings([]string{microlinkAssetURL(info.Logo)})
	if len(icons) == 0 {
		return nil, errors.New("microlink 结果缺少 logo.url")
	}

	record := &iconRecord{
		Host:            host,
		Title:           strings.TrimSpace(info.Title),
		Name:            firstNonEmpty(strings.TrimSpace(info.Title), strings.TrimSpace(info.Publisher), host),
		URL:             firstNonEmpty(targetURL, normalizeLookupURL(rawInput)),
		FinalURL:        firstNonEmpty(targetURL, normalizeLookupURL(rawInput)),
		Description:     strings.TrimSpace(info.Description),
		BackgroundColor: firstNonEmpty(microlinkBackgroundColor(info.Logo), microlinkBackgroundColor(info.Image)),
		Icons:           icons,
		Src:             firstString(icons),
		Source:          "microlink",
		FetchedAt:       time.Now().UTC(),
	}
	record.LocalIcons = a.downloadIconsBestEffort(host, icons)

	a.mu.Lock()
	a.cacheRecords[host] = record
	a.mu.Unlock()

	if err := a.save(); err != nil {
		return nil, err
	}
	return record, nil
}

func (a *app) resolveSiteMetadata(ctx context.Context, r *http.Request, inputURL string) (*responseData, metadataLookupDebug, error) {
	debug := metadataLookupDebug{
		FinalURL: inputURL,
	}
	htmlMetadata, htmlErr := a.fetchPageMetadata(ctx, inputURL)
	finalURL := inputURL
	if htmlMetadata != nil && strings.TrimSpace(htmlMetadata.FinalURL) != "" {
		finalURL = strings.TrimSpace(htmlMetadata.FinalURL)
	}
	debug.FinalURL = finalURL
	debug.HTMLFound = htmlMetadata != nil
	debug.HTMLError = errorText(htmlErr)

	queryTarget := firstNonEmpty(finalURL, inputURL)
	record, iconResolution, iconErr := a.lookupOrFetchRecord(ctx, queryTarget)
	debug.IconResolution = iconResolution
	debug.IconError = errorText(iconErr)
	debug.HasRecord = record != nil

	iconURL := ""
	if record != nil {
		iconURL = firstString(a.publicIcons(r, record))
	}
	if iconURL == "" && htmlMetadata != nil {
		iconURL = strings.TrimSpace(htmlMetadata.IconURL)
	}

	title := ""
	description := ""
	if htmlMetadata != nil {
		title = strings.TrimSpace(htmlMetadata.Title)
		description = strings.TrimSpace(htmlMetadata.Description)
	}
	if title == "" && record != nil {
		title = firstNonEmpty(strings.TrimSpace(record.Title), strings.TrimSpace(record.Name))
	}
	if description == "" && record != nil {
		description = strings.TrimSpace(record.Description)
	}

	backgroundColor := ""
	if record != nil {
		backgroundColor = strings.TrimSpace(record.BackgroundColor)
	}

	if htmlMetadata == nil && record == nil {
		if htmlErr != nil {
			return nil, debug, htmlErr
		}
		if iconErr != nil {
			return nil, debug, iconErr
		}
		return nil, debug, errors.New("site metadata lookup failed")
	}

	fetchedAt := time.Now().UTC().Format(time.RFC3339)
	response := &responseData{
		URL:             nullableString(firstNonEmpty(finalURL, inputURL)),
		Title:           nullableString(title),
		Icon:            nullableString(iconURL),
		Description:     nullableString(description),
		BackgroundColor: nullableString(backgroundColor),
		FetchedAt:       &fetchedAt,
	}
	debug.HasIcon = hasStringValue(response.Icon)
	debug.HasDescription = hasStringValue(response.Description)
	debug.BackgroundColor = backgroundColor
	debug.Title = title
	return response, debug, nil
}

func (a *app) lookupOrFetchRecord(ctx context.Context, rawInput string) (*iconRecord, string, error) {
	host := normalizeHost(rawInput)
	if host == "" {
		return nil, "invalid_host", errors.New("host 参数格式无效")
	}
	record := a.getRecord(host)
	if record != nil && strings.EqualFold(strings.TrimSpace(record.Source), "seed") {
		completed, err := a.ensureSeedRecordCompleted(ctx, host)
		if err != nil {
			log.Printf("complete seed record %s: %v", host, err)
		} else if completed != nil {
			record = completed
			return record, "seed_completed", nil
		}
		return record, "seed", nil
	}
	if record != nil && !isRecordStale(record) {
		return record, "cache", nil
	}

	refreshed, err := a.fetchAndCache(ctx, rawInput)
	if err != nil {
		if record != nil {
			return record, "stale_cache_fallback", nil
		}
		return nil, "fetch_error", err
	}
	return refreshed, "fetched_" + strings.ToLower(strings.TrimSpace(firstNonEmpty(refreshed.Source, "unknown"))), nil
}

func (a *app) fetchPageMetadata(ctx context.Context, rawURL string) (*pageMetadata, error) {
	targetURL := normalizeLookupURL(rawURL)
	if targetURL == "" {
		return nil, errors.New("invalid url")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", defaultUserAgent)

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, err
	}

	finalURL := firstNonEmpty(resp.Request.URL.String(), resp.Request.URL.Scheme+"://"+resp.Request.URL.Host+resp.Request.URL.Path, targetURL)
	htmlBody := string(body)
	return &pageMetadata{
		FinalURL:    finalURL,
		Title:       parseHTMLTitle(htmlBody),
		Description: parseHTMLMetaContent(htmlBody, "description"),
		IconURL:     parseHTMLIconURL(htmlBody, finalURL),
	}, nil
}

func (a *app) downloadIcons(host string, icons []string) ([]string, error) {
	if len(icons) == 0 {
		return nil, nil
	}

	var local []string
	for i, iconURL := range icons {
		name, err := a.downloadOne(host, i, iconURL)
		if err != nil {
			return nil, err
		}
		local = append(local, name)
	}
	return local, nil
}

func (a *app) downloadIconsBestEffort(host string, icons []string) []string {
	if len(icons) == 0 {
		return nil
	}

	local := make([]string, 0, len(icons))
	for i, iconURL := range icons {
		name, err := a.downloadOne(host, i, iconURL)
		if err != nil {
			continue
		}
		local = append(local, name)
	}
	return local
}

func (a *app) downloadOne(host string, index int, iconURL string) (string, error) {
	req, err := http.NewRequest(http.MethodGet, iconURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", defaultUserAgent)

	resp, err := a.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("download icon %s failed: HTTP %d", iconURL, resp.StatusCode)
	}

	ext := extFromResponse(iconURL, resp.Header.Get("Content-Type"))
	fileName := sanitizeHost(host)
	if index > 0 {
		fileName = fmt.Sprintf("%s-%d", fileName, index+1)
	}
	fileName += ext

	target := filepath.Join(a.cacheIconDir, fileName)
	file, err := os.Create(target)
	if err != nil {
		return "", err
	}
	defer file.Close()

	if _, err := io.Copy(file, resp.Body); err != nil {
		return "", err
	}
	return fileName, nil
}

func (a *app) getRecord(host string) *iconRecord {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if record, ok := a.seedRecords[host]; ok {
		return record
	}
	if record, ok := a.cacheRecords[host]; ok {
		return record
	}
	return nil
}

func (a *app) save() error {
	a.mu.RLock()
	records := make([]*iconRecord, 0, len(a.cacheRecords))
	for _, record := range a.cacheRecords {
		clone := *record
		records = append(records, &clone)
	}
	a.mu.RUnlock()

	sort.Slice(records, func(i, j int) bool {
		return records[i].Host < records[j].Host
	})

	cache := cacheFile{
		UpdatedAt: time.Now(),
		Records:   records,
	}

	data, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		return err
	}

	tmp := a.cachePath + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, a.cachePath)
}

func (a *app) toResponse(r *http.Request, record *iconRecord) *responseData {
	if record == nil {
		return nil
	}
	backgroundColor := nullableString(record.BackgroundColor)
	finalURL := firstNonEmpty(record.FinalURL, record.URL)
	title := firstNonEmpty(record.Title, record.Name)
	icon := nullableString(firstString(a.publicIcons(r, record)))
	fetchedAt := recordTimestamp(record).UTC().Format(time.RFC3339)
	return &responseData{
		URL:             nullableString(finalURL),
		Title:           nullableString(title),
		Icon:            icon,
		Description:     nullableString(record.Description),
		BackgroundColor: backgroundColor,
		FetchedAt:       &fetchedAt,
	}
}

func (a *app) publicIcons(r *http.Request, record *iconRecord) []string {
	if record == nil {
		return nil
	}
	if len(record.LocalIcons) > 0 {
		out := make([]string, 0, len(record.LocalIcons))
		for _, name := range record.LocalIcons {
			out = append(out, a.publicIconURL(r, record, name))
		}
		return out
	}
	return append([]string(nil), record.Icons...)
}

func (a *app) publicIconURL(r *http.Request, record *iconRecord, fileName string) string {
	prefix := a.iconPrefix
	if !strings.EqualFold(record.Source, "seed") {
		prefix = a.cachePrefix
	}

	base := strings.TrimRight(a.publicIconBaseURL, "/")
	if base == "" {
		base = requestBaseURL(r)
	}
	return strings.TrimRight(base, "/") + prefix + strings.TrimLeft(fileName, "/")
}

func (a *app) deleteCacheRecord(host string) (bool, *iconRecord, error) {
	a.mu.Lock()
	record, ok := a.cacheRecords[host]
	if ok {
		delete(a.cacheRecords, host)
	}
	fallback := a.seedRecords[host]
	a.mu.Unlock()

	if !ok {
		return false, fallback, nil
	}

	for _, name := range record.LocalIcons {
		clean := filepath.Base(filepath.Clean(filepath.FromSlash(name)))
		_ = os.Remove(filepath.Join(a.cacheIconDir, clean))
	}

	if err := a.save(); err != nil {
		return false, nil, err
	}
	return true, fallback, nil
}

func (a *app) isSeedHost(host string) bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	_, ok := a.seedRecords[host]
	return ok
}

func (c *itabClient) lookup(ctx context.Context, targetURL string) (*itabInfoData, error) {
	escaped := url.QueryEscape(targetURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf(defaultITabAPI, escaped), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("accept", "application/json, text/plain, */*")
	req.Header.Set("accept-language", "zh-CN,zh;q=0.9")
	req.Header.Set("dnt", "1")
	req.Header.Set("mode", "itab")
	req.Header.Set("origin", defaultITabOrigin)
	req.Header.Set("priority", "u=1, i")
	req.Header.Set("referer", defaultITabOrigin+"/")
	req.Header.Set("sec-ch-ua", `"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"`)
	req.Header.Set("sec-ch-ua-mobile", "?0")
	req.Header.Set("sec-ch-ua-platform", `"Linux"`)
	req.Header.Set("sec-fetch-dest", "empty")
	req.Header.Set("sec-fetch-mode", "cors")
	req.Header.Set("sec-fetch-site", "same-site")
	req.Header.Set("user-agent", defaultUserAgent)
	if strings.TrimSpace(c.fp) != "" {
		req.Header.Set("fp", c.fp)
	}
	if strings.TrimSpace(c.signatureKey) != "" {
		req.Header.Set("signaturekey", c.signatureKey)
	}
	if strings.TrimSpace(c.token) != "" {
		req.Header.Set("token", c.token)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("itab info lookup failed: HTTP %d", resp.StatusCode)
	}

	var body itabInfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}
	if body.Code != 200 {
		return nil, fmt.Errorf("itab info lookup failed: %s", body.Msg)
	}
	return &body.Data, nil
}

func (c *microlinkClient) lookup(ctx context.Context, targetURL string) (*microlinkData, error) {
	endpoint, err := url.Parse(firstNonEmpty(strings.TrimSpace(c.baseURL), defaultMicrolinkAPI))
	if err != nil {
		return nil, err
	}

	query := endpoint.Query()
	query.Set("url", targetURL)
	query.Set("palette", "true")
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("accept", "application/json, text/plain, */*")
	req.Header.Set("user-agent", defaultUserAgent)
	if strings.TrimSpace(c.apiKey) != "" {
		req.Header.Set("x-api-key", strings.TrimSpace(c.apiKey))
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("microlink lookup failed: HTTP %d", resp.StatusCode)
	}

	var body microlinkLookupResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}
	if !strings.EqualFold(strings.TrimSpace(body.Status), "success") {
		return nil, fmt.Errorf("microlink lookup failed: %s", firstNonEmpty(body.Message, "unknown error"))
	}
	if firstNonEmpty(body.Data.URL, body.Data.Title, body.Data.Publisher, microlinkAssetURL(body.Data.Logo)) == "" {
		return nil, errors.New("microlink 结果为空")
	}

	return &body.Data, nil
}

func normalizeHost(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if strings.Contains(raw, "://") {
		u, err := url.Parse(raw)
		if err == nil && u.Hostname() != "" {
			return strings.ToLower(u.Hostname())
		}
	}
	if strings.Contains(raw, "/") {
		u, err := url.Parse("https://" + raw)
		if err == nil && u.Hostname() != "" {
			return strings.ToLower(u.Hostname())
		}
	}
	host := strings.ToLower(strings.TrimSpace(raw))
	host = strings.TrimPrefix(host, "//")
	host = strings.TrimSuffix(host, "/")
	if idx := strings.Index(host, ":"); idx >= 0 {
		host = host[:idx]
	}
	return host
}

func lookupInput(r *http.Request) (query string, host string, err error) {
	query = strings.TrimSpace(r.URL.Query().Get("host"))
	if query == "" {
		query = strings.TrimSpace(r.URL.Query().Get("url"))
	}
	if query == "" {
		return "", "", errors.New("host 参数不能为空")
	}
	host = normalizeHost(query)
	if host == "" {
		return "", "", errors.New("host 参数格式无效")
	}
	return query, host, nil
}

func candidateURLs(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	if strings.Contains(raw, "://") {
		return []string{raw}
	}
	host := normalizeHost(raw)
	if host == "" {
		return nil
	}
	return []string{
		"https://" + host + "/",
		"http://" + host + "/",
	}
}

func normalizeLookupURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	if strings.Contains(raw, "://") {
		if parsed, err := url.Parse(raw); err == nil && parsed.Host != "" {
			return parsed.String()
		}
		return ""
	}

	host := normalizeHost(raw)
	if host == "" {
		return ""
	}
	return "https://" + host + "/"
}

func googleFaviconURL(raw string) string {
	host := normalizeHost(raw)
	if host == "" {
		return ""
	}

	endpoint := &url.URL{
		Scheme: "https",
		Host:   "t2.gstatic.com",
		Path:   "/faviconV2",
	}
	query := endpoint.Query()
	query.Set("client", "SOCIAL")
	query.Set("type", "FAVICON")
	query.Set("fallback_opts", "TYPE,SIZE,URL")
	query.Set("url", "https://"+host+"/")
	query.Set("size", "128")
	endpoint.RawQuery = query.Encode()
	return endpoint.String()
}

func parseHTMLTitle(document string) string {
	match := titleTagPattern.FindStringSubmatch(document)
	if len(match) < 2 {
		return ""
	}
	return strings.TrimSpace(html.UnescapeString(stripTags(match[1])))
}

func parseHTMLMetaContent(document, name string) string {
	for _, tag := range metaTagPattern.FindAllString(document, -1) {
		attrs := parseTagAttributes(tag)
		attrName := strings.ToLower(firstNonEmpty(attrs["name"], attrs["property"]))
		if attrName != strings.ToLower(name) {
			continue
		}
		return strings.TrimSpace(html.UnescapeString(attrs["content"]))
	}
	return ""
}

func parseHTMLIconURL(document, baseURL string) string {
	for _, tag := range linkTagPattern.FindAllString(document, -1) {
		attrs := parseTagAttributes(tag)
		rel := strings.ToLower(attrs["rel"])
		if !strings.Contains(rel, "icon") {
			continue
		}
		href := strings.TrimSpace(attrs["href"])
		if href == "" {
			continue
		}
		if absolute, err := url.Parse(href); err == nil {
			if base, baseErr := url.Parse(baseURL); baseErr == nil {
				return base.ResolveReference(absolute).String()
			}
		}
		return href
	}
	return ""
}

func parseTagAttributes(tag string) map[string]string {
	matches := attrPattern.FindAllStringSubmatch(tag, -1)
	attrs := make(map[string]string, len(matches))
	for _, match := range matches {
		if len(match) < 5 {
			continue
		}
		value := firstNonEmpty(match[2], match[3], match[4])
		attrs[strings.ToLower(match[1])] = html.UnescapeString(value)
	}
	return attrs
}

func stripTags(value string) string {
	var builder strings.Builder
	inTag := false
	for _, char := range value {
		switch char {
		case '<':
			inTag = true
		case '>':
			inTag = false
		default:
			if !inTag {
				builder.WriteRune(char)
			}
		}
	}
	return builder.String()
}

func extFromResponse(iconURL, contentType string) string {
	contentType = strings.ToLower(contentType)
	switch {
	case strings.Contains(contentType, "image/svg"):
		return ".svg"
	case strings.Contains(contentType, "image/png"):
		return ".png"
	case strings.Contains(contentType, "image/jpeg"):
		return ".jpg"
	case strings.Contains(contentType, "image/webp"):
		return ".webp"
	case strings.Contains(contentType, "image/gif"):
		return ".gif"
	case strings.Contains(contentType, "image/x-icon"), strings.Contains(contentType, "image/vnd.microsoft.icon"):
		return ".ico"
	}

	if u, err := url.Parse(iconURL); err == nil {
		if ext := filepath.Ext(strings.ToLower(u.Path)); ext != "" {
			return ext
		}
	}
	return ".img"
}

func compactStrings(values []string) []string {
	out := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func firstString(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func nullableString(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func recordTimestamp(record *iconRecord) time.Time {
	if record == nil {
		return time.Time{}
	}
	if !record.FetchedAt.IsZero() {
		return record.FetchedAt
	}
	return record.UpdatedAt
}

func isRecordStale(record *iconRecord) bool {
	if record == nil || strings.EqualFold(strings.TrimSpace(record.Source), "seed") {
		return false
	}
	fetchedAt := recordTimestamp(record)
	if fetchedAt.IsZero() {
		return true
	}
	return time.Since(fetchedAt) > cacheRefreshTTL
}

func microlinkAssetURL(asset *microlinkAsset) string {
	if asset == nil {
		return ""
	}
	return strings.TrimSpace(asset.URL)
}

func microlinkBackgroundColor(asset *microlinkAsset) string {
	if asset == nil {
		return ""
	}
	if color := firstNonEmpty(asset.BackgroundColor, asset.Color, asset.AlternativeColor); color != "" {
		return color
	}
	if len(asset.Palette) > 0 {
		return strings.TrimSpace(asset.Palette[0])
	}
	return ""
}

func seedSupplementFromMicrolink(info *microlinkData) *seedSupplement {
	if info == nil {
		return nil
	}
	return &seedSupplement{
		Title:           firstNonEmpty(strings.TrimSpace(info.Title), strings.TrimSpace(info.Publisher)),
		OriginalIconURL: microlinkAssetURL(info.Logo),
		BackgroundColor: firstNonEmpty(microlinkBackgroundColor(info.Logo), microlinkBackgroundColor(info.Image)),
	}
}

func seedSupplementFromITab(info *itabInfoData) *seedSupplement {
	if info == nil {
		return nil
	}
	return &seedSupplement{
		Title:           strings.TrimSpace(info.Name),
		OriginalIconURL: firstNonEmpty(strings.TrimSpace(info.Src), strings.TrimSpace(info.ImgSrc), firstString(info.Icon)),
		BackgroundColor: strings.TrimSpace(info.BackgroundColor),
	}
}

func seedSupplementHasData(supplement *seedSupplement) bool {
	if supplement == nil {
		return false
	}
	return firstNonEmpty(supplement.Title, supplement.OriginalIconURL, supplement.BackgroundColor) != ""
}

func seedItemNeedsCompletion(item *seedItem) bool {
	if item == nil {
		return false
	}
	return firstNonEmpty(item.Title) == "" ||
		firstNonEmpty(item.OriginalIconURL) == "" ||
		firstNonEmpty(item.BackgroundColor) == ""
}

func ensureLeadingTrailingSlash(value string) string {
	if !strings.HasPrefix(value, "/") {
		value = "/" + value
	}
	if !strings.HasSuffix(value, "/") {
		value += "/"
	}
	return value
}

func sanitizeHost(host string) string {
	host = strings.ToLower(strings.TrimSpace(host))
	replacer := strings.NewReplacer(":", "_", "/", "_", "\\", "_", "?", "_", "*", "_", "\"", "_", "<", "_", ">", "_", "|", "_")
	return replacer.Replace(host)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Close()
}

func samePath(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	absA, errA := filepath.Abs(a)
	absB, errB := filepath.Abs(b)
	if errA != nil || errB != nil {
		return filepath.Clean(a) == filepath.Clean(b)
	}
	return filepath.Clean(absA) == filepath.Clean(absB)
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func loadConfig(path string) (serviceConfig, error) {
	cfg := serviceConfig{
		Addr:              defaultAddr,
		DataDir:           filepath.Join(".", "data"),
		IconPrefix:        defaultIconPrefix,
		CachePrefix:       "/cache/",
		PublicIconBaseURL: "",
		ITabFP:            "",
		ITabSignatureKey:  "",
		ITabToken:         "",
		MicrolinkBaseURL:  defaultMicrolinkAPI,
		MicrolinkAPIKey:   "",
	}
	cfg.SeedIconDir = filepath.Join(cfg.DataDir, "icons")
	cfg.CacheIconDir = filepath.Join(cfg.DataDir, "cache")
	cfg.CacheFile = filepath.Join(cfg.DataDir, defaultCacheName)
	cfg.SeedJSON = filepath.Join(".", "data", defaultSeedName)

	configDir := "."
	if path != "" {
		configDir = filepath.Dir(path)
		if data, err := os.ReadFile(path); err == nil {
			if err := json.Unmarshal(data, &cfg); err != nil {
				return cfg, err
			}
		} else if !errors.Is(err, os.ErrNotExist) {
			return cfg, err
		}
	}

	overrideConfigFromEnv(&cfg)

	cfg.IconPrefix = ensureLeadingTrailingSlash(cfg.IconPrefix)
	cfg.DataDir = resolveConfigPath(configDir, cfg.DataDir)
	cfg.SeedIconDir = resolveConfigPath(configDir, cfg.SeedIconDir)
	cfg.CacheIconDir = resolveConfigPath(configDir, cfg.CacheIconDir)
	cfg.CacheFile = resolveConfigPath(configDir, cfg.CacheFile)
	cfg.SeedJSON = resolveConfigPath(configDir, cfg.SeedJSON)
	cfg.PublicIconBaseURL = strings.TrimRight(strings.TrimSpace(cfg.PublicIconBaseURL), "/")
	return cfg, nil
}

func overrideConfigFromEnv(cfg *serviceConfig) {
	cfg.Addr = env("ADDR", cfg.Addr)
	cfg.DataDir = env("DATA_DIR", cfg.DataDir)
	cfg.SeedIconDir = env("SEED_ICON_DIR", cfg.SeedIconDir)
	cfg.CacheIconDir = env("CACHE_ICON_DIR", cfg.CacheIconDir)
	cfg.CacheFile = env("CACHE_FILE", cfg.CacheFile)
	cfg.SeedJSON = env("SEED_JSON", cfg.SeedJSON)
	cfg.IconPrefix = env("ICON_PREFIX", cfg.IconPrefix)
	cfg.CachePrefix = env("CACHE_PREFIX", cfg.CachePrefix)
	cfg.PublicIconBaseURL = env("PUBLIC_ICON_BASE_URL", env("BASE_URL", cfg.PublicIconBaseURL))
	cfg.ITabFP = env("ITAB_FP", cfg.ITabFP)
	cfg.ITabSignatureKey = env("ITAB_SIGNATUREKEY", cfg.ITabSignatureKey)
	cfg.ITabToken = env("ITAB_TOKEN", cfg.ITabToken)
	cfg.MicrolinkBaseURL = env("MICROLINK_BASE_URL", cfg.MicrolinkBaseURL)
	cfg.MicrolinkAPIKey = env("MICROLINK_API_KEY", cfg.MicrolinkAPIKey)
}

func resolveConfigPath(configDir, value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return value
	}
	if filepath.IsAbs(value) {
		return value
	}
	return filepath.Clean(filepath.Join(configDir, value))
}

func resolveSeedAssetPath(seedPath, value string) string {
	value = strings.TrimSpace(value)
	if value == "" || filepath.IsAbs(value) {
		return value
	}

	directPath := filepath.Clean(value)
	if fileExists(directPath) {
		return directPath
	}

	seedRelativePath := filepath.Clean(filepath.Join(filepath.Dir(seedPath), value))
	if fileExists(seedRelativePath) {
		return seedRelativePath
	}

	return directPath
}

func writeSeedFile(path string, seed *seedFile) error {
	if seed == nil {
		return errors.New("seed is nil")
	}

	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(seed); err != nil {
		return err
	}
	data := bytes.TrimSuffix(buffer.Bytes(), []byte("\n"))

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func requestBaseURL(r *http.Request) string {
	if r == nil {
		return ""
	}
	scheme := "http"
	if xfProto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); xfProto != "" {
		scheme = xfProto
	} else if r.TLS != nil {
		scheme = "https"
	}

	host := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = strings.TrimSpace(r.Host)
	}
	if host == "" {
		return ""
	}
	return scheme + "://" + host
}

func (w *responseRecorder) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *responseRecorder) Write(data []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(data)
	w.bytesWritten += n
	return n, err
}

func (w *responseRecorder) StatusCode() int {
	if w.statusCode == 0 {
		return http.StatusOK
	}
	return w.statusCode
}

func newRequestTrace(r *http.Request) *requestTrace {
	requestID := strings.TrimSpace(r.Header.Get("X-Request-Id"))
	if requestID == "" {
		requestID = fmt.Sprintf("icon-%d", atomic.AddUint64(&requestSeq, 1))
	}
	return &requestTrace{
		id:           requestID,
		startedAt:    time.Now().UTC(),
		method:       r.Method,
		path:         r.URL.Path,
		remoteAddr:   trimLogValue(r.RemoteAddr, 120),
		forwardedFor: trimLogValue(r.Header.Get("X-Forwarded-For"), 120),
		userAgent:    trimLogValue(r.UserAgent(), 200),
	}
}

func (t *requestTrace) log(event string, fields map[string]any) {
	payload := map[string]any{
		"ts":           time.Now().UTC().Format(time.RFC3339Nano),
		"scope":        "icon-service",
		"event":        event,
		"requestId":    t.id,
		"method":       t.method,
		"path":         t.path,
		"remoteAddr":   t.remoteAddr,
		"forwardedFor": t.forwardedFor,
		"userAgent":    t.userAgent,
	}
	for key, value := range fields {
		payload[key] = value
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("icon-service event=%s request_id=%s marshal_error=%v", event, t.id, err)
		return
	}

	log.Printf("%s", data)
}

func trimLogValue(value string, max int) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= max {
		return value
	}
	return value[:max] + "..."
}

func errorText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func hasStringValue(value *string) bool {
	return value != nil && strings.TrimSpace(*value) != ""
}

func writeJSON(w http.ResponseWriter, status int, body responseBody) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
