/**
 * Fetches YouTube Shorts data for a predefined list of keywords and periods,
 * saving the results to CSV files.
 */
import "dotenv/config";
import { google } from "googleapis";
import { writeFileSync } from "fs";
import { format } from "date-fns";

const KEYWORDS_TO_PROCESS = [
  "THE FINALS",
  "ザ･ファイナルズ",
  "Fortnite",
  "フォートナイト",
  "PUBG: BATTLEGROUNDS",
  "PUBG",
  "Battlefield 2042",
  "バトルフィールド",
  "Call of Duty",
  "Marvel Rivals",
  "マーベル・ライバルズ",
  "Counter-Strike 2",
];
const PERIODS_IN_DAYS = [1095, 365, 90];

const youtube = google.youtube({
  version: "v3",
  auth: process.env["YT_API_KEY"],
});

/** ISO 文字列 → YYYY-MM-DD HH:mm */
const jp = (iso?: string) =>
  iso ? format(new Date(iso), "yyyy-MM-dd HH:mm") : "";

async function run(keyword: string, periodDays: number) {
  // search.list
  const publishedAfterDate = new Date(
    Date.now() - periodDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const search = await youtube.search.list({
    part: ["id"],
    q: keyword,
    type: ["video"],
    order: "viewCount",
    videoDuration: "short",
    maxResults: 50,
    publishedAfter: publishedAfterDate,
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
      link: `https://youtube.com/shorts/${v.id}`,
      views: v.statistics?.viewCount ?? "0",
      likes: v.statistics?.likeCount ?? "0",
      comments: v.statistics?.commentCount ?? "0",
      channelTitle: v.snippet?.channelTitle ?? "",
      description: (v.snippet?.description ?? "")
        .replace(/"/g, '""')
        .replace(/\n/g, " "),
      tags: (v.snippet?.tags ?? []).join(", "),
      published: jp(v.snippet?.publishedAt ?? undefined),
    }));

  const csv = [
    "Title,Link,Views,Likes,Comments,Channel Title,Description,Tags,Published",
    ...rows.map(
      (r) =>
        `"${r.title}","${r.link}",${r.views},${r.likes},${r.comments},"${r.channelTitle}","${r.description}","${r.tags}",${r.published}`
    ),
  ].join("\n");

  const stamp = format(new Date(), "yyyyMMdd_HHmmss");
  const safe = (keyword || "all").replace(/[\/:*?"<>| ]+/g, "_");
  const filename = `${safe}_${periodDays}days_${stamp}.csv`;

  writeFileSync(`results/${filename}`, csv, "utf8");
  console.log(`✅  Saved → ${filename}`);
}

async function main() {
  console.log(
    `Starting batch processing for ${KEYWORDS_TO_PROCESS.length} keywords and ${PERIODS_IN_DAYS.length} periods.`
  );
  for (const kw of KEYWORDS_TO_PROCESS) {
    for (const period of PERIODS_IN_DAYS) {
      try {
        console.log(`
Processing: Keyword="${kw}", Period=${period} days`);
        await run(kw, period);
      } catch (err: any) {
        console.error(
          `
❌ Error processing keyword "${kw}" for period ${period} days:`
        );
        if (err.response && err.response.data && err.response.data.error) {
          // Log Google API specific error
          console.error(
            "API Error:",
            JSON.stringify(err.response.data.error, null, 2)
          );
        } else if (err instanceof Error) {
          console.error(`Error message: ${err.message}`);
          // Stack trace can be very verbose in a loop, enable if deep debugging is needed.
          // if (err.stack) { console.error(`Stack trace: ${err.stack}`); }
        } else {
          console.error("Unknown error:", err);
        }
        console.log(`Continuing to next task...`);
      }
    }
  }
  console.log("\nBatch processing finished.");
}

main().catch((err) => {
  console.error("A critical error occurred in the main execution:", err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
