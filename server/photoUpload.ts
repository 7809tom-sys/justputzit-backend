/**
 * Photo upload REST endpoint with EXIF GPS city-verification.
 * POST /api/photos/upload  (multipart/form-data, field: "photo")
 * DELETE /api/photos/:id
 */
import type { Express, Request } from "express";
import multer from "multer";
import type { FileFilterCallback } from "multer";
import { createContext } from "./_core/context";
import { storagePut } from "./storage";
import { insertProfilePhoto, getProfilePhotos, setPrimaryPhoto, deleteProfilePhoto } from "./db";

// exifr is an ESM-only package; we import it dynamically
let _exifr: any = null;
async function getExifr() {
  if (!_exifr) _exifr = await import("exifr");
  return _exifr;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

/** Convert decimal GPS coords to a city name via reverse-geocode (no API key needed with OSM Nominatim) */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "JustPutzit/1.0 (contact@justputzit.com)" },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    return (
      data?.address?.city ||
      data?.address?.town ||
      data?.address?.village ||
      data?.address?.county ||
      null
    );
  } catch {
    return null;
  }
}

/** Normalise city strings for loose comparison (lowercase, strip punctuation) */
function normaliseCity(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

export function registerPhotoUploadRoutes(app: Express) {
  // ── Upload a new photo ──────────────────────────────────────────────────────
  app.post(
    "/api/photos/upload",
    upload.single("photo"),
    async (req, res) => {
      try {
        // Auth via session cookie (same as tRPC context)
        const ctx = await createContext({ req, res } as any);
        if (!ctx.user) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        const multerReq = req as Request & { file?: Express.Multer.File };
        if (!multerReq.file) {
          res.status(400).json({ error: "No file uploaded" });
          return;
        }

        const buffer = multerReq.file.buffer;
        const mimeType = multerReq.file.mimetype;
        const ext = mimeType.split("/")[1] || "jpg";

        // ── Extract EXIF GPS ────────────────────────────────────────────────
        let exifLat: string | undefined;
        let exifLng: string | undefined;
        let exifCity: string | undefined;
        let cityVerified = false;
        let verificationNote = "No GPS data in photo";

        try {
          const exifr = await getExifr();
          const gps = await exifr.gps(buffer);
          if (gps?.latitude && gps?.longitude) {
            exifLat = String(gps.latitude);
            exifLng = String(gps.longitude);

            // Reverse-geocode to get city
            const geocodedCity = await reverseGeocode(gps.latitude, gps.longitude);
            exifCity = geocodedCity ?? undefined;

            // Compare against user's registered city
            const userCity = (ctx.user as any).city || (ctx.user as any).gpsVerifiedCity || (ctx.user as any).claimedCity;
            if (exifCity && userCity) {
              cityVerified = normaliseCity(exifCity) === normaliseCity(userCity) ||
                normaliseCity(exifCity).includes(normaliseCity(userCity)) ||
                normaliseCity(userCity).includes(normaliseCity(exifCity));
              verificationNote = cityVerified
                ? `Photo location matches your city (${exifCity})`
                : `Photo location (${exifCity}) does not match your registered city (${userCity})`;
            } else if (exifCity) {
              verificationNote = `Photo taken in ${exifCity} — no registered city on file to compare`;
            }
          }
        } catch {
          verificationNote = "Could not read GPS data from photo";
        }

        // ── Upload to S3 ────────────────────────────────────────────────────
        const filename = `profile-photos/${ctx.user.id}/${Date.now()}.${ext}`;
        const { key, url } = await storagePut(filename, buffer, mimeType);

        // ── Save to DB ──────────────────────────────────────────────────────
        await insertProfilePhoto({
          userId: ctx.user.id,
          s3Key: key,
          url,
          exifLat,
          exifLng,
          exifCity,
          cityVerified,
          verificationNote,
        });

        const photos = await getProfilePhotos(ctx.user.id);
        res.json({ success: true, photos, verificationNote, cityVerified });
      } catch (err: any) {
        console.error("[PhotoUpload]", err);
        res.status(500).json({ error: err.message || "Upload failed" });
      }
    }
  );

  // ── Set primary photo ───────────────────────────────────────────────────────
  app.post("/api/photos/:id/primary", async (req, res) => {
    try {
      const ctx = await createContext({ req, res } as any);
      if (!ctx.user) { res.status(401).json({ error: "Unauthorized" }); return; }
      await setPrimaryPhoto(Number(req.params.id), ctx.user.id);
      const photos = await getProfilePhotos(ctx.user.id);
      res.json({ success: true, photos });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Delete a photo ──────────────────────────────────────────────────────────
  app.delete("/api/photos/:id", async (req, res) => {
    try {
      const ctx = await createContext({ req, res } as any);
      if (!ctx.user) { res.status(401).json({ error: "Unauthorized" }); return; }
      await deleteProfilePhoto(Number(req.params.id), ctx.user.id);
      const photos = await getProfilePhotos(ctx.user.id);
      res.json({ success: true, photos });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
