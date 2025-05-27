/**
 * 例:  npx ts-node src/shorts.ts "心理テスト"
 *      (ビルド後)  node dist/shorts.js "心理テスト"
 */
import "dotenv/config";
import { google } from "googleapis";
import { writeFileSync } from "fs";
import { format } from "date-fns";

const KEYWORD =
  process.argv[2] ??
  (() => {
    console.error("❌ キーワードを引数にください");
    process.exit(1);
  })();
const youtube = google.youtube({ version: "v3", auth: process.env.YT_API_KEY });

/** ISO 文字列 → YYYY-MM-DD HH:mm */
const jp = (iso?: string) =>
  iso ? format(new Date(iso), "yyyy-MM-dd HH:mm") : "";

async function run() {
  // search.list
  const ONE_YEAR_AGO = new Date(
    Date.now() - 365 * 24 * 60 * 60 * 1000
  ).toISOString();

  const search = await youtube.search.list({
    part: ["id"],
    q: KEYWORD,
    type: ["video"],
    order: "viewCount",
    videoDuration: "short",
    maxResults: 100,
    publishedAfter: ONE_YEAR_AGO,
  });

  const ids = (search.data.items ?? [])
    .map((i) => i.id?.videoId!)
    .filter(Boolean);

  // videos.list
  const videos = await youtube.videos.list({
    part: ["snippet", "statistics", "contentDetails"],
    id: ids,
  });

  const rows = (videos.data.items ?? [])
    .filter((v) =>
      /^PT(\d+S|[0-5]?\dS)$/.test(v.contentDetails?.duration ?? "")
    ) // ≤60s
    .map((v) => ({
      title: (v.snippet?.title ?? "").replace(/"/g, '""'),
      views: v.statistics?.viewCount ?? "0",
      published: jp(v.snippet?.publishedAt),
      link: `https://youtube.com/shorts/${v.id}`,
    }));

  const csv = [
    "Title,Views,Published,Link",
    ...rows.map((r) => `"${r.title}",${r.views},${r.published},"${r.link}"`),
  ].join("\n");

  const stamp = format(new Date(), "yyyyMMdd_HHmmss");
  const safe = KEYWORD.replace(/[\\/:*?"<>| ]+/g, "_");
  const filename = `${safe}_${stamp}.csv`;

  writeFileSync(filename, csv, "utf8");
  console.log(`✅  Saved → ${filename}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
