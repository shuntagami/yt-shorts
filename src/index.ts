// ts-node でそのまま動くサンプル
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();
const API_KEY = process.env.YT_API_KEY!;
const KEYWORD = "コミュニケーション"; // 検索ワード
const PAGE_SIZE = 25; // 1 ページ最大 50

async function fetchShorts() {
  const youtube = google.youtube({ version: "v3", auth: API_KEY });

  // 1) キーワード検索（再生数順 & short）
  const searchRes = await youtube.search.list({
    part: ["id", "snippet"],
    q: KEYWORD,
    type: ["video"],
    order: "viewCount",
    videoDuration: "short", // 4分未満
    maxResults: PAGE_SIZE,
  });

  // 2) Shorts らしさを追加判定（<=60 秒）
  const ids = searchRes.data.items?.map((i) => i.id!.videoId!) ?? [];
  const vids = await youtube.videos.list({
    part: ["contentDetails", "statistics", "snippet"],
    id: ids,
  });

  const shortsOnly =
    vids.data.items?.filter((v) => {
      const durISO = v.contentDetails?.duration!; // e.g. PT45S
      const seconds =
        durISO
          .match(/\d+/g)
          ?.reduce(
            (s, n, i, arr) => s + +n * [3600, 60, 1].slice(-arr.length)[i],
            0
          ) ?? 0;

      return seconds <= 60; // 60秒以下
    }) ?? [];

  // 3) 出力
  shortsOnly.forEach((v) => {
    console.log(
      `${v.snippet?.title} | ${v.statistics?.viewCount} views | https://youtube.com/shorts/${v.id}`
    );
  });
}

fetchShorts().catch(console.error);
