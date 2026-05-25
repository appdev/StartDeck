import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_MOVIE_CALENDAR_WIDGET_TYPE = "itab-movie-calendar-05";
export const ITAB_MOVIE_CALENDAR_CATALOG_ID = "movie-calendar";
export const ITAB_MOVIE_CALENDAR_RUNTIME = "itab-movie-calendar";
export const ITAB_MOVIE_CALENDAR_DATA_VERSION = 1;
export const ITAB_MOVIE_CALENDAR_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

export interface ItabMovieCalendarWidgetData {
  runtime: typeof ITAB_MOVIE_CALENDAR_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_MOVIE_CALENDAR_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
}

export interface ItabMovieCalendarEntry {
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
