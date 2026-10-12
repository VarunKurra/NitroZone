# Sources

Every statistic or factual claim shown in the app or on the website, with where it was checked. Items I could not verify are listed under **TODO-VERIFY** and are **not** shown in the UI.

| Claim (where it appears) | Source | How it was verified |
|---|---|---|
| Missouri corn growers intended to plant **3.80 million acres** in 2025 (landing, science) | [USDA NASS, Missouri Prospective Plantings, Mar 31 2025](https://www.nass.usda.gov/Statistics_by_State/Missouri/Publications/Press_Releases/2025/20250331-MO-Prospective-Plantings.pdf) | PDF text: "Corn growers intend to plant 3.80 million acres in 2025, up 10 percent from 2024." |
| **66%** of nitrogen delivered to the Gulf comes from cultivated crops, mostly corn and soybean (landing, science) | [USGS SPARROW, primary sources](https://water.usgs.gov/nawqa/sparrow/gulf_findings/primary_sources.html) | Page text: "66 percent of nitrogen originates from cultivated crops, mostly corn and soybean". |
| MU sensor demos 2004–2007: **+$15/ac, broke even on yield, saved 24 lb N/acre** (41-field average) (landing, science) | [Scharf et al., University of Missouri, *Crop Sensors to Guide Nitrogen Fertilizer Application*](https://extension.missouri.edu/media/wysiwyg/Extensiondata/Pro/NutrientManagement/Docs/Crop_Sensors_to_Guide_N_Application_to_Reduce_N_Loss.pdf) | Slide text: "2004-2007: +$15/ac on corn (41-field ave) – Broke even on yield – Saved 24 lb N/acre". Also supports "dark crop = low N rate, light crop = high N". |
| Canopy sensing from about **V10**, finished before **VT**; rapid N uptake from about **V8**; reference strips with **50–100% more N** (FAQ, science) | [Iowa State University, *In-Season Sensing for Nitrogen Stress in Corn*](https://www.agronext.iastate.edu/soilfertility/info/inseasonnstress.pdf) | PDF text quoted in the methodology. |
| Default N price **$0.75/lb N** (UAN32, last week of Sept 2026) (rates step, science) | [DTN Retail Fertilizer Trends, Oct 7 2026](https://www.dtnpf.com/agriculture/web/ag/crops/article/2026/10/07/uan32-leads-fertilizer-prices-higher) | Article: "UAN32 $0.75/lb.N". |
| Sufficiency-index research computes in-season N from SI around **0.90–0.95** (science) | [Varvel et al. 2007, *Agronomy Journal* 99:701–706](https://nue.okstate.edu/Index_Yield_Potential/varvel1.pdf) | Paper text: "Using SI values of 0.90, 0.925, and 0.95, the calculated amount of N needed…" |
| Sentinel-2 SCL classes (3 shadow, 8/9 cloud, 10 cirrus, 11 snow) | [Sentinel Hub, L2A Scene Classification](https://custom-scripts.sentinel-hub.com/sentinel-2/scene-classification) | Class table. |
| L2A processing baseline ≥ 04.00 uses a +1000 DN offset | Planetary Computer STAC item property `s2:processing_baseline` (05.11 for the demo scene); ESA L2A product spec | Checked on the live STAC item; the demo NDVI/NDRE are in the expected 0.7–0.9 range only with the offset removed. |
| Sentinel-2 bands: B4/B8 at 10 m, B5 at 20 m | [Copernicus Sentinel-2 MSI documentation](https://s2.pages.eopf.copernicus.eu/pdfs-adfs/MSI) | Band table. |
| Demo field is **93.3% corn (2025)** and **88.6% soybeans (2024)** | [USDA NASS Cropland Data Layer via CropScape](https://nassgeodata.gmu.edu/CropScape/) | Our own calculation: downloaded the 2024 and 2025 CDL clips and counted the 30 m pixels inside the demo boundary (872 pixels). |
| Demo scene: S2C_MSIL2A_20250701T164921_R026_T15SXD, 3.2% scene cloud | [Planetary Computer STAC](https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2C_MSIL2A_20250701T164921_R026_T15SXD_20250701T221619) | STAC item metadata. |

All numbers on the results screen (acres, rates, savings, health score, etc.) are computed live from imagery and settings, not quoted statistics.

## TODO-VERIFY (not shown in the UI)
- Exact equation and ΔSI coefficient of the Holland & Schepers (2010) variable-rate N model (Agron. J. 102:1415–1424). I couldn't read the primary paper, so NitroZone uses its own clearly labeled heuristic instead.
- Final 2025 Missouri corn **planted** acreage (only the March intentions figure is used).
