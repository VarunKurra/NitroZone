/**
 * The bundled demo field.
 *
 * A real corn field in Audrain County, Missouri (about 8 km northeast of Mexico, MO).
 * USDA NASS Cropland Data Layer 2025 classifies these pixels as corn (code 1) and
 * 2024 as soybeans (code 5), a typical corn-after-soybean rotation. The cached image is
 * the real Sentinel-2 L2A scene from 2025-07-01 (in-season, canopy established).
 *
 * Boundary traced from the Sentinel-2 true-colour image: county roads on the north and
 * east edges, a grassed waterway / field edge on the south-west.
 */
import type { FieldPolygon } from "@/lib/agronomy/types";

export const DEMO_FIELD_ID = "demo-audrain-mo";
export const DEMO_SCENE_ID = "S2C_MSIL2A_20250701T164921_R026_T15SXD_20250701T221619";
export const DEMO_SCENE_DATE = "2025-07-01T16:49:21Z";
export const DEMO_CACHE_URL = "/demo/demo-scene-2025-07-01.json";

export const DEMO_FIELD: FieldPolygon = {
  type: "Feature",
  properties: { name: "Audrain County demo field" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-91.634007, 39.310075],
        [-91.62502, 39.309969],
        [-91.625216, 39.29997],
        [-91.631187, 39.30004],
        [-91.632027, 39.301582],
        [-91.633031, 39.303621],
        [-91.633925, 39.305321],
        [-91.634075, 39.306561],
        [-91.634007, 39.310075],
      ],
    ],
  },
};

/**
 * Illustrative N-rich reference strip for the demo: a 20 m wide strip running the length
 * of the field. In a real field the farmer applies ~50-100% extra N here at planting.
 * (In the cached image no extra N was actually applied; the demo uses the strip only to
 * show how the sufficiency-index workflow behaves.)
 */
export const DEMO_REFERENCE_STRIP: FieldPolygon = {
  type: "Feature",
  properties: { name: "N-rich reference strip" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-91.6286, 39.3095],
        [-91.6284, 39.3095],
        [-91.62854, 39.3006],
        [-91.62874, 39.3006],
        [-91.6286, 39.3095],
      ],
    ],
  },
};

/** Map camera for the demo field. */
export const DEMO_VIEW = { center: [-91.6295, 39.305] as [number, number], zoom: 15.2 };
