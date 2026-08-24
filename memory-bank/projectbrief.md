# Project Brief: Banknotes Collection

## Overview
The **Banknotes Collection** is a local system designed for the management and automatic enrichment of a numismatic collection. It avoids traditional SQL databases in favor of a structured file-based approach using JSONs for metadata and a set of Python scripts for processing.

## Core Goals
- **Cataloging:** Store detailed metadata for banknotes in structured JSON files.
- **Automation:** Use local AI (via Ollama) to extract serial numbers and thematic information from images.
- **Asset Generation:** Automatically generate consolidated high-resolution images (`_FULL/`) and printable PDF labels using ReportLab.
- **Visualization:** Provide an interactive web interface (Vanilla JS, Pico.css) for browsing, searching, and editing the collection.

## Key Requirements
- **Local-First:** All data is stored in files; no external database server is required for core operations.
- **Single Source of Truth:** `_json/countries.json` and `_json/currencies.json` serve as the authoritative sources for geographical and monetary data.
- **Integrated Pipeline:** A workflow from raw images (`_originals/`) $\rightarrow$ AI processing $\rightarrow$ Metadata JSON $\rightarrow$ Consolidated Image $\rightarrow$ PDF Label/Web Display.

## Scope
- Management of banknote metadata.
- Image processing (ImageMagick).
- AI-driven data extraction.
- Web-based catalog frontend.
- Firebase hosting for the web interface.
