/**
 * Shared types for the NitroZone analysis engine.
 *
 * Vocabulary used throughout the code:
 *  - "pixel": one sample of the source raster (10 m for Sentinel-2, a few cm for drone imagery).
 *  - "cell":  one square of the prescription grid (default 20 m). Pixels are averaged into cells.
 *             Cells are what the sprayer/spreader controller actually reads.
 *  - "zone":  a group of cells that share one nitrogen rate. Zone 1 = lowest crop vigor.
 */
import type { Feature, MultiPolygon, Polygon } from "geojson";

/** Where the pixels came from. Always shown to the farmer. */
export type ImagerySource = "live" | "cached" | "synthetic" | "drone";

/** Which vegetation indices drive the analysis. */
export type SensorKind = "sentinel2" | "drone-rgb";

export type FieldPolygon = Feature<Polygon | MultiPolygon, { name?: string }>;

/** Metadata about the image that was analyzed. */
export interface SceneInfo {
  source: ImagerySource;
  sensor: SensorKind;
  /** e.g. "S2C_MSIL2A_20250701T164921_R026_T15SXD_20250701T221619" */
  sceneId: string | null;
  /** ISO date string of acquisition, null if unknown (e.g. un-dated drone JPG). */
  acquired: string | null;
  /** Scene-wide cloud cover reported by the provider (%), null if not applicable. */
  sceneCloudPct: number | null;
  /** Native ground sample distance of the primary bands (m). */
  resolutionM: number;
  /** Human readable provider, e.g. "Sentinel-2 L2A via Microsoft Planetary Computer". */
  provider: string;
  /** Free-text caveats (e.g. "image was not georeferenced; stretched to field bounds"). */
  notes: string[];
}

/**
 * A raster that has been clipped to the field's bounding box and resampled
 * onto a single regular grid in a metric CRS (UTM).
 * Arrays are row-major, row 0 = north edge.
 */
export interface IndexRaster {
  width: number;
  height: number;
  /** Proj4 definition of the metric CRS the grid lives in. */
  crs: string;
  /** Upper-left corner (x = easting, y = northing) in `crs` units (m). */
  originX: number;
  originY: number;
  /** Pixel size in metres. */
  pixelSize: number;
  /**
   * Primary nitrogen-stress index: NDRE for Sentinel-2, VARI for drone RGB.
   * NaN = masked (cloud, shadow, outside field, no data).
   */
  primary: Float32Array;
  /** Secondary index: NDVI for Sentinel-2, ExG for drone RGB. NaN = masked. */
  secondary: Float32Array;
  /** Optional true-colour preview (RGBA, same grid) for maps and the PDF report. */
  rgba?: Uint8ClampedArray;
  /** Count of pixels inside the field that were masked as cloud / shadow / snow / no-data. */
  maskedPixels: number;
  /** Count of pixels inside the field (masked or not). */
  fieldPixels: number;
}

/** One prescription grid cell. Coordinates are in the metric CRS of the raster. */
export interface GridCell {
  id: number;
  /** Column / row in the grid (row 0 = north). */
  col: number;
  row: number;
  /** Polygon ring(s) in metric CRS, clipped to the field boundary. */
  rings: number[][][];
  /** Same geometry in WGS84 lon/lat, for maps and exports. */
  ringsLngLat: number[][][];
  /** Area inside the field, acres. */
  areaAc: number;
  /** Centroid in WGS84. */
  center: [number, number];
  /** Mean primary index (NDRE / VARI) of valid pixels; NaN if none. */
  primary: number;
  /** Mean secondary index (NDVI / ExG) of valid pixels; NaN if none. */
  secondary: number;
  /** Fraction (0-1) of the cell's in-field pixels that were valid (not masked). */
  validFraction: number;
  /** True if the values were borrowed from neighbours because the cell had no valid pixels. */
  filled: boolean;
  /** True if this cell lies inside the farmer-drawn N-rich reference strip. */
  inReference: boolean;
}

/** Output of clustering, before any farmer edits. */
export interface ZoningResult {
  /** Zone number per cell (1 = lowest vigor), aligned with `cells`. */
  zoneOfCell: Int8Array;
  zoneCount: number;
  /** Primary-index cluster centres sorted ascending (zone 1 first). */
  centers: number[];
  /** Number of small fragments absorbed into neighbours. */
  mergedFragments: number;
  /** Primary-index break values between zones (for the histogram). */
  breaks: number[];
}

/** Farmer-editable settings. Every number here can be changed in the UI. */
export interface RateSettings {
  /** Flat / base sidedress rate in lb N per acre. */
  baseRate: number;
  /** Nitrogen price in $ per lb of actual N. */
  pricePerLbN: number;
  /** Per-zone rate adjustment as a fraction, e.g. +0.15 = 15% above base. Index 0 = zone 1. */
  adjustments: number[];
  /** Hard floor and ceiling for any zone rate (lb N/ac); keeps rates within applicator range. */
  minRate: number;
  maxRate: number;
}

export interface AnalysisSettings {
  zoneCount: 3 | 4 | 5;
  /** Prescription grid cell size (m). */
  cellSizeM: number;
  /** Fragments smaller than this (acres) are merged into a neighbouring zone. */
  minZoneAc: number;
  /** Apply a 3x3 majority filter to smooth speckle before merging. */
  smooth: boolean;
  /** Pixels closer than this to the boundary are ignored (mixed road/ditch pixels). */
  edgeBufferM: number;
}

export interface ZoneSummary {
  zone: number;
  cellCount: number;
  areaAc: number;
  /** Area-weighted means. */
  primary: number;
  secondary: number;
  /** Sufficiency index: zone primary / reference primary. */
  sufficiency: number;
  adjustment: number;
  rateLbAc: number;
  totalLbN: number;
  /** Flat-rate pounds for the same area. */
  flatLbN: number;
  /** Positive = this zone saves N vs flat. */
  savedLbN: number;
  savedUsd: number;
}

export interface PrescriptionTotals {
  areaAc: number;
  flatLbN: number;
  variableLbN: number;
  savedLbN: number;
  savedUsd: number;
  savedUsdPerAc: number;
  avgRateLbAc: number;
  /** True when the variable-rate plan uses more N than the flat plan. */
  usesMoreThanFlat: boolean;
}
