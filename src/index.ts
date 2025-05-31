/**
 * 例:  npx ts-node src/shorts.ts "心理テスト"
 *      (ビルド後)  node dist/shorts.js "心理テスト"
 *      キーワードなし: npx ts-node src/shorts.ts
 */
import "dotenv/config";
import { google } from "googleapis";
import { writeFileSync } from "fs";
import { format } from "date-fns";

const KEYWORD = process.argv[2];
const DAYS_AGO_ARG = process.argv[3];
const youtube = google.youtube({
  version: "v3",
  auth: process.env["YT_API_KEY"],
});

/** ISO 文字列 → YYYY-MM-DD HH:mm */
const jp = (iso?: string) =>
  iso ? format(new Date(iso), "yyyy-MM-dd HH:mm") : "";

async function run() {
  // search.list
  const daysAgo = DAYS_AGO_ARG ? parseInt(DAYS_AGO_ARG, 10) : NaN;
  const numberOfDays = !isNaN(daysAgo) && daysAgo > 0 ? daysAgo : 365;

  const publishedAfterDate = new Date(
    Date.now() - numberOfDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const search = await youtube.search.list({
    part: ["id"],
    q: KEYWORD || undefined, // キーワードがない場合はundefinedにして全体から検索
    type: ["video"],
    order: "viewCount",
    videoDuration: "short",
    maxResults: 25,
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
  const safe = (KEYWORD || "all").replace(/[\\/:*?"<>| ]+/g, "_");
  const filename = `${safe}_${numberOfDays}days_${stamp}.csv`;

  writeFileSync(`results/${filename}`, csv, "utf8");
  console.log(`✅  Saved → ${filename}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
