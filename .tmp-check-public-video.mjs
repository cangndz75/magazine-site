import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    "postgresql://postgres:MagazineDev_2026!@localhost:5432/magazine_site",
});

const slug = "browser-qa-1786921642615";
const item = await pool.query(
  `SELECT id, published_version_id, publication_status FROM content_items WHERE slug = $1`,
  [slug],
);
console.log("item", item.rows[0]);
if (item.rows[0]?.published_version_id) {
  const videos = await pool.query(
    `SELECT cvv.sort_order, eva.provider, eva.provider_video_id, eva.title
     FROM content_version_videos cvv
     JOIN editorial_video_assets eva ON eva.id = cvv.video_asset_id
     WHERE cvv.content_version_id = $1
     ORDER BY cvv.sort_order`,
    [item.rows[0].published_version_id],
  );
  console.log("published videos", videos.rows);
}
await pool.end();
