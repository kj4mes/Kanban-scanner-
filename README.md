# Kanban Scanner

Mobile-first HVAC truck-stock test bed for scanning Kanban QR codes and product barcodes, tallying materials used on a job, and producing a clean end-of-job summary for entry into FieldEdge.

## Current prototype

- Start a job / enter a work-order number
- Scan QR codes with the iPhone camera
- Scan common product barcodes (Code 128, Code 39, UPC, EAN)
- Repeated scans automatically increment quantity
- Manual part-number entry
- +/- quantity correction
- Local persistence in the browser so a refresh does not erase the active job
- Copyable end-of-job material summary
- 85-item galvanized inventory test data from the Kanban tag set

## QR format

Each Kanban item has a stable internal ID such as `KB001`.

Recommended QR payload:

```text
KANBAN:KB001
```

The app also accepts `KB001` directly.

Part numbers can be entered directly when they are unique. The source inventory currently contains duplicate part numbers, so the QR's stable `KBxxx` ID prevents ambiguity.

## Important duplicate-source-data note

The current source list contains at least these duplicate part numbers:

- `306465` = 3/4" Union **and** 1" x 2.5" nipple
- `306522` = 1 1/4" x 3/4" 90 **and** 1 1/4" x 3/4" coupling

Those should be verified against the real FieldEdge item list before production use.

## Running it

This is a static web app. Camera access on iPhone requires the site to be served over HTTPS (or localhost during development). A hosting step will be needed before field testing on an iPhone.

## Next steps

1. Verify the two duplicate part numbers against FieldEdge.
2. Add QR codes using the `KANBAN:KBxxx` payloads to a small batch of physical tags.
3. Host the app over HTTPS for iPhone testing.
4. Test scan speed and ergonomics on a real install.
5. Add manufacturer-barcode-to-Kanban-item mapping.
6. If approved later, connect the submitted material list to the FieldEdge API.
