package handlers

import (
	"encoding/json"
	"log"
	"path/filepath"
	"startdeck-backend/config"
	"startdeck-backend/utils"
	"sync"
	"time"
)

const (
	widgetCacheKindRSS               = "rss"
	widgetCacheKindHot               = "hot"
	widgetCacheKindItabMovieCalendar = "itab_movie_calendar"
	widgetCacheKindItabWeather       = "itab_weather"
	widgetCacheKindItabPoem          = "itab_poem"
	widgetCacheKindItabDailyEnglish  = "itab_daily_english"
)

type WidgetCacheItem struct {
	Data         interface{} `json:"data"`
	UpdatedAt    int64       `json:"updatedAt"` // Unix timestamp in ms
	TTL          int64       `json:"ttl"`       // Seconds
	SourceStatus string      `json:"sourceStatus"`
}

// WidgetCache manages the unified cache file
type WidgetCache struct {
	mu          sync.RWMutex
	filePath    string
	syncSave    bool
	refreshLock sync.Mutex
	refreshing  map[string]bool
	// Structure: kind -> key -> item
	cache map[string]map[string]*WidgetCacheItem
}

var sharedWidgetCache = &WidgetCache{
	cache:      make(map[string]map[string]*WidgetCacheItem),
	refreshing: make(map[string]bool),
}

func InitWidgetCache() {
	sharedWidgetCache.filePath = filepath.Join(config.DataDir, "widget_cache.json")
	sharedWidgetCache.load()
}

func (c *WidgetCache) load() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := utils.ReadJSON(c.filePath, &c.cache); err != nil {
		log.Printf("Failed to read widget cache: %v", err)
		return
	}
}

func (c *WidgetCache) saveAsync() {
	if c.filePath == "" {
		return
	}
	c.mu.RLock()
	data, err := json.Marshal(c.cache)
	c.mu.RUnlock()

	if err != nil {
		log.Printf("Failed to marshal widget cache: %v", err)
		return
	}

	var next map[string]map[string]*WidgetCacheItem
	if err := json.Unmarshal(data, &next); err != nil {
		log.Printf("Failed to prepare widget cache: %v", err)
		return
	}
	if err := utils.WriteJSON(c.filePath, next); err != nil {
		log.Printf("Failed to write widget cache: %v", err)
	}
}

func (c *WidgetCache) persist() {
	if c.syncSave {
		c.saveAsync()
		return
	}
	go c.saveAsync()
}

func (c *WidgetCache) Get(kind, key string, out interface{}) (bool, bool, *WidgetCacheItem, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	kindMap, ok := c.cache[kind]
	if !ok {
		return false, false, nil, nil
	}

	item, ok := kindMap[key]
	if !ok {
		return false, false, nil, nil
	}

	// Check TTL
	now := time.Now().UnixMilli()
	isFresh := (now - item.UpdatedAt) < (item.TTL * 1000)

	// Copy data to out using JSON roundtrip for simplicity and safety
	dataBytes, _ := json.Marshal(item.Data)
	if err := json.Unmarshal(dataBytes, out); err != nil {
		return true, isFresh, item, err
	}

	return true, isFresh, item, nil
}

func (c *WidgetCache) Set(kind, key string, data interface{}, ttl time.Duration, status string) error {
	c.mu.Lock()
	if c.cache[kind] == nil {
		c.cache[kind] = make(map[string]*WidgetCacheItem)
	}

	c.cache[kind][key] = &WidgetCacheItem{
		Data:         data,
		UpdatedAt:    time.Now().UnixMilli(),
		TTL:          int64(ttl.Seconds()),
		SourceStatus: status,
	}
	c.mu.Unlock()

	c.persist()
	return nil
}

func (c *WidgetCache) MarkStatus(kind, key, status string) error {
	c.mu.Lock()
	if c.cache[kind] == nil || c.cache[kind][key] == nil {
		c.mu.Unlock()
		return nil
	}
	c.cache[kind][key].SourceStatus = status
	c.mu.Unlock()

	c.persist()
	return nil
}

func (c *WidgetCache) StartRefresh(tag string) bool {
	c.refreshLock.Lock()
	defer c.refreshLock.Unlock()

	if c.refreshing[tag] {
		return false
	}
	c.refreshing[tag] = true
	return true
}

func (c *WidgetCache) EndRefresh(tag string) {
	c.refreshLock.Lock()
	defer c.refreshLock.Unlock()
	delete(c.refreshing, tag)
}
