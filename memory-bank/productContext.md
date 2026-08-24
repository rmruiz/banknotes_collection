# Product Context: Banknotes Collection

## Purpose
This project solves the problem of managing a large, diverse collection of banknotes. Instead of manual spreadsheets or complex database software, it leverages a "Git-friendly" flat-file JSON structure that allows for version control, easy backups, and programmatic enrichment.

## User Experience Goals
- **Discovery:** Users should be able to search the collection by pick number, country, or year using a responsive web interface.
- **Efficiency:** Automatic extraction of metadata (serial numbers, themes) using AI reduces manual data entry.
- **Tangibility:** Generating printable PDF labels allows the physical collection to be organized and identified easily.
- **Accessibility:** The web interface allows the collection to be shared via Firebase Hosting while remaining editable locally.

## How It Works (The Workflow)
1. **Acquisition:** Raw photos (Front/Back) are placed in `web/_originals/<id>/`.
2. **Indexing:** Scripts process these photos and JSON metadata to create a unified `collection.json` for the web.
3. **Enrichment:** Ollama (LLaVA/Gemma) analyzes the images to suggest serial numbers or themes.
4. **Visualization:** The web app renders the collection using the generated index and consolidated images in `web/_FULL/`.
5. **Physical Organization:** PDF labels are generated based on the current JSON metadata for printing.
