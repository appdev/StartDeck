import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_MOVIE_CALENDAR_WIDGET_TYPE = "sd-movie-calendar-05";
export const SD_MOVIE_CALENDAR_CATALOG_ID = "movie-calendar";
export const SD_MOVIE_CALENDAR_RUNTIME = "sd-movie-calendar";
export const SD_MOVIE_CALENDAR_DATA_VERSION = 1;
export const SD_MOVIE_CALENDAR_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";

export interface SdMovieCalendarWidgetData {
  runtime: typeof SD_MOVIE_CALENDAR_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_MOVIE_CALENDAR_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
}

export interface SdMovieCalendarEntry {
  date: string;
  day: string;
  monthLabel: string;
  weekday: string;
  movieTitle: string;
  rating: string;
  quote: string;
  posterUrl: string;
  coverUrl: string;
  sourceUrl: string;
  year: string;
  area: string;
  director: string;
  intro: string;
  genres: string[];
  bgColor: string;
  textColor: string;
  sourceStatus: string;
}
