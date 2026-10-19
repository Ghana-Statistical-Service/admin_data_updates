# MMDA administrative data dashboard

Data quality for Ghana's 261 Metropolitan, Municipal and District Assemblies, 2015–2025, built from 2,877,573 records. It reflects the *MMDAs Administrative Data Quality Assessment Report* and the *District Completion Factsheets*.

**Pages** (left menu; every page follows the region and district filters)

| Page | What it shows |
| --- | --- |
| Dashboard | Records, submissions, % of expected and overall completion; records over time; districts by completion band; key findings; the district list. In a district: submissions and plots for all 15 indicators. |
| Completeness | Records against expected, completeness over time, region tile map, indicators by completion band, best and worst districts. In a district: the factsheet table (% complete, missing years, conflicting figures, 2026–2030 data), the generated summary sentence and the national and regional rank. |
| Uniqueness | Repeat submissions and conflicting figures, by year, indicator, region and district. |
| Validity | Records failing the two validity rules (small values, percentages above 100). |
| Accuracy | Possible outliers flagged for verification. |
| Methodology | Definitions, how completion is scored, colour bands, priorities for action and limitations from the assessment. |

The selection is kept in the page address (for example `#page=validity&region=Ahafo&district=Asunafo+South+District`), so any view can be shared as a link.

It is a plain static site: no build step, no server code, no network calls (d3 and the data are bundled).

```
index.html        page
styles.css        design tokens (light and dark) and page styles
app.js            dashboard logic
dash-shim.js      small data layer (selection, calculations)
data/data.js      the data the page reads
data/*.json       the same data as separate files (district_indicator_years.json feeds the indicator plots)
vendor/d3.min.js  d3 v7
vercel.json       Vercel settings
.github/workflows/pages.yml   GitHub Pages deploy
scripts/build_data.py         rebuilds data/data.js from data/*.json
```

## Run it locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## Put it on GitHub

```bash
cd mmda-dashboard
git init -b main
git add .
git commit -m "MMDA administrative data dashboard"
# create an empty repository on github.com first, then:
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

### GitHub Pages

The included workflow publishes the site on every push to `main`.
In the repository go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site appears at `https://<your-user>.github.io/<your-repo>/`.

## Deploy on Vercel

**From GitHub (recommended):** at vercel.com choose **Add New → Project**, import the repository, and set
**Framework Preset: Other**, leave **Build Command** empty and **Output Directory** as `.`. Every push to `main` then redeploys.

**From the command line:**

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

## Update the data

Replace the files in `data/` (keep the same column names), then run `python3 scripts/build_data.py` and commit.

## Notes

- **Records** are values reported for 2015–2025. Repeat submissions of a cell are counted as reported.
- **% of expected** compares a district's records with 28,468 expected records per district (7,430,148 across 261 districts). A few districts exceed 100% because of repeat submissions.
- **Submissions** are distinct submission times attached to a district's workbooks. 47,482 records have no matched submission time; they appear as "No matched time" in a district's submissions table and are not counted as a submission.
- **Indicators** are the 15 thematic areas (the `Indicator` column of the source data).
- **Repeat submissions**, **invalid values** and **possible outliers** follow the assessment report; outliers are flagged for verification and are not automatically errors.
- **Completion** is the share of years 2015–2025 with a reported value, averaged over the 15 thematic areas (SDGs Budget is scored over 2019–2025).
- The data contains district-level figures only. Workbook file names are not included.
