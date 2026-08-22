import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";

const PRESENTATION_PREFIX = "sunum-";
const HOMEPAGE_ID = "00000000-0000-4000-8000-000000000001";
const ANALYTICS_JOB_NAME = "analytics.aggregate.v1";
const SAFE_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type DemoArticle = {
  key: string;
  title: string;
  category: string;
  author: string;
  status: "PUBLISHED" | "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED";
  viewsBase: number;
  homepageBase: number;
};

const categories = [
  ["magazin", "Magazin"],
  ["diziler", "Diziler"],
  ["moda", "Moda"],
  ["yasam", "Yaşam"],
  ["kultur-sanat", "Kültür & Sanat"],
  ["seyahat", "Seyahat"],
  ["video", "Video"],
] as const;

const authors = [
  ["deniz-koral", "Deniz Koral"],
  ["ece-tan", "Ece Tan"],
  ["mert-sayin", "Mert Sayın"],
  ["leyla-eren", "Leyla Eren"],
  ["asli-yaman", "Aslı Yaman"],
  ["baran-tuna", "Baran Tuna"],
  ["nil-aksu", "Nil Aksu"],
  ["selin-arda", "Selin Arda"],
] as const;

const articles: DemoArticle[] = [
  ["01", "Yeni sezonun en çok konuşulan dizileri", "diziler", "deniz-koral", "PUBLISHED", 158000, 42000],
  ["02", "Ünlü oyuncudan yeni proje açıklaması", "magazin", "ece-tan", "PUBLISHED", 141000, 38000],
  ["03", "Yaz stilinde öne çıkan 7 trend", "moda", "asli-yaman", "PUBLISHED", 116000, 26000],
  ["04", "İstanbul'da hafta sonu için 5 rota", "seyahat", "baran-tuna", "PUBLISHED", 109000, 21000],
  ["05", "Sezon finali sosyal medyayı ikiye böldü", "diziler", "mert-sayin", "PUBLISHED", 98000, 18000],
  ["06", "Yeni albüm için geri sayım başladı", "kultur-sanat", "leyla-eren", "PUBLISHED", 91000, 16000],
  ["07", "Festival gecesinden dikkat çeken kareler", "magazin", "nil-aksu", "PUBLISHED", 87000, 15000],
  ["08", "Bu hafta vizyona girecek yapımlar", "kultur-sanat", "selin-arda", "PUBLISHED", 81000, 13500],
  ["09", "Kırmızı halıda gecenin en zarif görünümleri", "moda", "asli-yaman", "PUBLISHED", 76000, 12500],
  ["10", "Dijital platformlarda haftanın öne çıkanları", "diziler", "mert-sayin", "PUBLISHED", 73000, 11800],
  ["11", "Şehir hayatında küçük kaçış rehberi", "yasam", "baran-tuna", "PUBLISHED", 69000, 10200],
  ["12", "Kamera arkasından özel notlar", "video", "deniz-koral", "PUBLISHED", 65000, 9800],
  ["13", "Stil dosyası: gardıropta yeni dönem", "moda", "asli-yaman", "PUBLISHED", 62000, 9200],
  ["14", "Sahne öncesi hazırlık rutini", "magazin", "ece-tan", "PUBLISHED", 60000, 8800],
  ["15", "Büyük buluşma öncesi dizi setinden haberler", "diziler", "mert-sayin", "PUBLISHED", 57000, 8200],
  ["16", "Hafta sonu konser ajandası", "kultur-sanat", "leyla-eren", "PUBLISHED", 54000, 7600],
  ["17", "Yeni mekanlar: şehrin sakin durakları", "yasam", "baran-tuna", "PUBLISHED", 51000, 7000],
  ["18", "Ekranda dönüş yapan unutulmaz karakterler", "diziler", "deniz-koral", "PUBLISHED", 49000, 6800],
  ["19", "Minimal takı trendi yeniden yükselişte", "moda", "nil-aksu", "PUBLISHED", 47000, 6400],
  ["20", "Kısa tatil için Ege rotaları", "seyahat", "baran-tuna", "PUBLISHED", 45000, 6100],
  ["21", "Oyunculukta yeni kuşağın yükselişi", "magazin", "ece-tan", "PUBLISHED", 43000, 5700],
  ["22", "Müzik listelerinde haftanın sürprizi", "kultur-sanat", "leyla-eren", "PUBLISHED", 41000, 5400],
  ["23", "Set modasında rahat şıklık", "moda", "asli-yaman", "PUBLISHED", 39000, 5100],
  ["24", "Pazar kahvesi için mahalle rehberi", "yasam", "selin-arda", "PUBLISHED", 37000, 4800],
  ["25", "Sosyal medyada haftanın magazin gündemi", "magazin", "nil-aksu", "PUBLISHED", 35000, 4500],
  ["26", "Dizi müzikleri neden yeniden popüler?", "diziler", "mert-sayin", "PUBLISHED", 33000, 4300],
  ["27", "Kültür ajandasında kaçırılmayacak sergiler", "kultur-sanat", "leyla-eren", "PUBLISHED", 31000, 4100],
  ["28", "Video röportaj: yaratıcı ekip anlatıyor", "video", "deniz-koral", "PUBLISHED", 29500, 3900],
  ["29", "Şehirden ilham alan renk paletleri", "moda", "asli-yaman", "PUBLISHED", 28000, 3600],
  ["30", "Haftanın kısa haber turu", "magazin", "ece-tan", "PUBLISHED", 26000, 3400],
  ["31", "Yeni sezon yayın takvimi nasıl şekilleniyor?", "diziler", "mert-sayin", "IN_REVIEW", 0, 0],
  ["32", "Kapak çekiminden ilk izlenimler", "magazin", "nil-aksu", "IN_REVIEW", 0, 0],
  ["33", "Sonbahar gardırobuna geçiş rehberi", "moda", "asli-yaman", "IN_REVIEW", 0, 0],
  ["34", "Şehrin yeni sanat durakları", "kultur-sanat", "leyla-eren", "IN_REVIEW", 0, 0],
  ["35", "Ünlü isimlerin tatil notları", "seyahat", "baran-tuna", "IN_REVIEW", 0, 0],
  ["36", "Editör masasında bekleyen özel röportaj", "magazin", "deniz-koral", "DRAFT", 0, 0],
  ["37", "Hafta sonu ekran seçkisi", "diziler", "mert-sayin", "DRAFT", 0, 0],
  ["38", "Kırmızı halı analiz dosyası", "moda", "asli-yaman", "DRAFT", 0, 0],
  ["39", "Pazartesi sabahı yayınlanacak özel dosya", "yasam", "selin-arda", "SCHEDULED", 0, 0],
  ["40", "Akşam bülteni için magazin özeti", "magazin", "ece-tan", "SCHEDULED", 0, 0],
  ["41", "Yeni fragman yayınından ilk notlar", "video", "deniz-koral", "SCHEDULED", 0, 0],
  ["42", "Yayın öncesi son kontrol bekleyen dosya", "kultur-sanat", "leyla-eren", "APPROVED", 0, 0],
] .map(([key, title, category, author, status, viewsBase, homepageBase]) => ({
  key,
  title,
  category,
  author,
  status: status as DemoArticle["status"],
  viewsBase: Number(viewsBase),
  homepageBase: Number(homepageBase),
}));

function deterministicUuid(input: string): string {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function parseEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index < 0) {
      continue;
    }
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, index).trim()] = value;
  }
  return env;
}

function databaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const editorEnv = resolve(process.cwd(), "../../apps/editor/.env.local");
  return parseEnvFile(editorEnv).DATABASE_URL ?? "";
}

function assertLocalDatabase(url: string): void {
  const parsed = new URL(url);
  if (!SAFE_DB_HOSTS.has(parsed.hostname)) {
    throw new Error("Presentation seed requires a loopback database host.");
  }
  const database = parsed.pathname.replace(/^\//, "").toLowerCase();
  if (!database || /prod|production|staging/.test(database)) {
    throw new Error("Presentation seed refused a production-like database name.");
  }
}

function articleSlug(article: DemoArticle): string {
  return `${PRESENTATION_PREFIX}${article.key}`;
}

function articleId(article: DemoArticle): string {
  return deterministicUuid(`presentation-content-${article.key}`);
}

function versionId(article: DemoArticle): string {
  return deterministicUuid(`presentation-version-${article.key}`);
}

async function cleanup(client: PoolClient): Promise<void> {
  const old = await client.query<{ id: string; legal_hold_action_id: string | null }>(
    "select id, legal_hold_action_id from content_items where slug like $1",
    [`${PRESENTATION_PREFIX}%`],
  );
  const ids = old.rows.map((row) => row.id);
  if (ids.length === 0) {
    return;
  }
  await client.query(
    `update content_items
     set publication_status = 'NEVER_PUBLISHED',
         published_version_id = null,
         draft_version_id = null,
         scheduled_version_id = null,
         published_at = null,
         public_date_modified = null,
         scheduled_at = null,
         legal_hold_at = null,
         legal_hold_reason = null,
         legal_hold_action_id = null
     where id = any($1::uuid[])`,
    [ids],
  );
  await client.query("delete from homepage_slots where content_item_id = any($1::uuid[])", [ids]);
  await client.query("delete from analytics_content_daily where content_item_id = any($1::uuid[])", [ids]);
  await client.query("delete from analytics_category_daily where content_item_id = any($1::uuid[])", [ids]);
  await client.query("delete from analytics_author_daily where content_item_id = any($1::uuid[])", [ids]);
  await client.query("delete from analytics_homepage_slot_daily where content_item_id = any($1::uuid[])", [ids]);
  await client.query("delete from analytics_source_daily where content_item_id = any($1::uuid[])", [ids]);
  await client.query("delete from content_review_events where content_item_id = any($1::uuid[])", [ids]);
  await client.query("delete from content_legal_actions where content_item_id = any($1::uuid[])", [ids]);
  await client.query("delete from content_versions where content_item_id = any($1::uuid[])", [ids]);
  await client.query("delete from content_items where id = any($1::uuid[])", [ids]);
}

async function upsertTaxonomy(client: PoolClient): Promise<{
  categoryIds: Map<string, string>;
  authorIds: Map<string, string>;
}> {
  const categoryIds = new Map<string, string>();
  for (const [slug, name] of categories) {
    const id = deterministicUuid(`presentation-category-${slug}`);
    await client.query(
      `insert into categories (id, name, slug, is_active, created_at, updated_at)
       values ($1, $2, $3, true, now(), now())
       on conflict (slug) do update set name = excluded.name, is_active = true, updated_at = now()`,
      [id, name, slug],
    );
    const row = await client.query<{ id: string }>("select id from categories where slug = $1", [slug]);
    categoryIds.set(slug, row.rows[0]!.id);
  }

  const authorIds = new Map<string, string>();
  for (const [slug, displayName] of authors) {
    const id = deterministicUuid(`presentation-author-${slug}`);
    await client.query(
      `insert into authors (id, display_name, slug, bio, is_active, created_at, updated_at)
       values ($1, $2, $3, $4, true, now(), now())
       on conflict (slug) do update set display_name = excluded.display_name, bio = excluded.bio, is_active = true, updated_at = now()`,
      [id, displayName, slug, "MAGAZİN CMS sunum veri seti için kurgusal editör."],
    );
    const row = await client.query<{ id: string }>("select id from authors where slug = $1", [slug]);
    authorIds.set(slug, row.rows[0]!.id);
  }

  return { categoryIds, authorIds };
}

async function actorId(client: PoolClient): Promise<string> {
  const id = deterministicUuid("presentation-super-admin");
  await client.query(
    `insert into staff_users (id, email, display_name, status, scope_mode, created_at, updated_at)
     values ($1, 'sunum-super-admin@magazine.local', 'Sunum Yayin Direktoru', 'ACTIVE', 'ALL', now(), now())
     on conflict (email) do update set
       display_name = excluded.display_name,
       status = 'ACTIVE',
       scope_mode = 'ALL',
       disabled_at = null,
       updated_at = now()`,
    [id],
  );
  const row = await client.query<{ id: string }>(
    "select id from staff_users where email = 'sunum-super-admin@magazine.local'",
  );
  const staffUserId = row.rows[0]!.id;
  await client.query(
    `insert into staff_user_roles (staff_user_id, role)
     values ($1, 'SUPER_ADMIN')
     on conflict (staff_user_id, role) do nothing`,
    [staffUserId],
  );
  return staffUserId;
}

async function insertContent(
  client: PoolClient,
  categoryIds: Map<string, string>,
  authorIds: Map<string, string>,
  staffUserId: string,
): Promise<void> {
  const now = new Date("2026-08-22T09:00:00.000Z");
  for (const [index, article] of articles.entries()) {
    const itemId = articleId(article);
    const vId = versionId(article);
    const categoryId = categoryIds.get(article.category)!;
    const authorId = authorIds.get(article.author)!;
    const createdAt = new Date(now.getTime() - (48 - index) * 60 * 60 * 1000);
    const isPublished = article.status === "PUBLISHED";
    const isScheduled = article.status === "SCHEDULED";
    const workflowStatus =
      article.status === "PUBLISHED" || article.status === "SCHEDULED"
        ? "APPROVED"
        : article.status;
    const scheduledAt = isScheduled
      ? new Date(now.getTime() + (index - 37) * 3 * 60 * 60 * 1000)
      : null;

    await client.query(
      `insert into content_items (
        id, content_kind, slug, publication_status, schedule_generation,
        published_at, public_date_modified, created_at, updated_at
      )
      values ($1, 'ARTICLE', $2, 'NEVER_PUBLISHED', 0, null, null, $3, $3)`,
      [itemId, articleSlug(article), createdAt],
    );
    await client.query(
      `insert into content_versions (
        id, content_item_id, version_number, workflow_status, title, subtitle,
        excerpt, body, seo_title, seo_description, robots, credibility,
        syndicated, is_material_update, created_at
      )
      values ($1, $2, 1, $3, $4, $5, $6, $7::jsonb, $4, $6, 'index,follow',
        'CONFIRMED', false, false, $8)`,
      [
        vId,
        itemId,
        workflowStatus,
        article.title,
        "MAGAZİN CMS sunum içeriği",
        `${article.title} başlığı altında hazırlanan kurgusal yayın dosyası.`,
        JSON.stringify({
          blocks: [
            {
              type: "paragraph",
              text: `${article.title} için hazırlanan kurgusal sunum metni.`,
            },
          ],
        }),
        createdAt,
      ],
    );
    await client.query(
      "insert into content_version_categories (content_version_id, category_id, is_primary) values ($1, $2, true)",
      [vId, categoryId],
    );
    await client.query(
      "insert into content_version_authors (content_version_id, author_id, role, sort_order) values ($1, $2, 'AUTHOR', 0)",
      [vId, authorId],
    );

    if (isPublished) {
      await client.query(
        `update content_items
         set published_version_id = $2,
             publication_status = 'PUBLISHED',
             published_at = $3,
             public_date_modified = $3,
             updated_at = $3
         where id = $1`,
        [itemId, vId, createdAt],
      );
    } else if (isScheduled) {
      await client.query(
        `update content_items
         set scheduled_version_id = $2,
             scheduled_at = $3,
             schedule_generation = 1,
             updated_at = $4
         where id = $1`,
        [itemId, vId, scheduledAt, createdAt],
      );
    } else {
      await client.query(
        "update content_items set draft_version_id = $2, updated_at = $3 where id = $1",
        [itemId, vId, createdAt],
      );
    }

    if (article.status === "IN_REVIEW") {
      await client.query(
        `insert into content_review_events
          (id, content_item_id, content_version_id, event_type, actor_id, note, created_at)
         values ($1, $2, $3, 'SUBMITTED', $4, null, $5)`,
        [
          deterministicUuid(`presentation-review-${article.key}`),
          itemId,
          vId,
          staffUserId,
          createdAt,
        ],
      );
    }
  }
}

async function insertAttention(client: PoolClient, staffUserId: string): Promise<void> {
  for (const [index, holdArticle] of articles.slice(30, 36).entries()) {
    const itemId = articleId(holdArticle);
    const vId = versionId(holdArticle);
    const actionId = deterministicUuid(`presentation-legal-hold-${index + 1}`);
    await client.query(
    `insert into content_legal_actions (
      id, content_item_id, content_version_id, action_type, polarity,
      reason_category, internal_note, public_note, actor_staff_user_id, created_at, effective_at
    )
    values ($1, $2, $3, 'LEGAL_HOLD', 'APPLY', 'EDITORIAL_STANDARDS',
      'Sunum veri seti için kurgusal hukuki bekletme sinyali.',
        null, $4, now() - interval '45 minutes', now() - interval '45 minutes')`,
      [actionId, itemId, vId, staffUserId],
    );
    await client.query(
    `update content_items
       set legal_hold_at = now() - interval '45 minutes',
         legal_hold_reason = 'EDITORIAL_STANDARDS',
         legal_hold_action_id = $2
     where id = $1`,
      [itemId, actionId],
    );
  }

  for (const article of articles.slice(36, 38)) {
    await client.query(
      `insert into content_review_events
        (id, content_item_id, content_version_id, event_type, actor_id, note, created_at)
       values ($1, $2, $3, 'CHANGES_REQUESTED', $4,
        'Sunum veri seti: başlık ve görsel hiyerarşi yeniden kontrol edilmeli.',
        now() - interval '20 minutes')`,
      [
        deterministicUuid(`presentation-change-request-${article.key}`),
        articleId(article),
        versionId(article),
        staffUserId,
      ],
    );
  }
}

async function insertHomepage(client: PoolClient, staffUserId: string): Promise<string> {
  const versionId = deterministicUuid("presentation-homepage-version");
  await client.query(
    `insert into homepages (id, published_version_id, draft_version_id, updated_at)
     values ($1, null, null, now())
     on conflict (id) do nothing`,
    [HOMEPAGE_ID],
  );
  await client.query(
    `insert into homepage_versions
      (id, homepage_id, created_at, updated_at, created_by_staff_user_id, published_at)
     values ($1, $2, now() - interval '2 hours', now() - interval '2 hours', $3, now() - interval '2 hours')
     on conflict (id) do update
       set updated_at = excluded.updated_at,
           published_at = excluded.published_at,
           created_by_staff_user_id = excluded.created_by_staff_user_id`,
    [versionId, HOMEPAGE_ID, staffUserId],
  );

  const slots = ["LEAD", "SUPPORT_1", "SUPPORT_2", "FEATURED_1", "FEATURED_2", "FEATURED_3", "FEATURED_4", "FEATURED_5"];
  for (const [index, slot] of slots.entries()) {
    await client.query(
      `insert into homepage_slots (homepage_version_id, slot_key, content_item_id)
       values ($1, $2, $3)
       on conflict (homepage_version_id, slot_key) do update set content_item_id = excluded.content_item_id`,
      [versionId, slot, articleId(articles[index]!)],
    );
  }
  await client.query(
    "update homepages set published_version_id = $2, draft_version_id = null, updated_at = now() where id = $1",
    [HOMEPAGE_ID, versionId],
  );
  return versionId;
}

function bucketStart(dayOffset: number): Date {
  const base = new Date("2026-08-15T21:00:00.000Z");
  return new Date(base.getTime() + dayOffset * 24 * 60 * 60 * 1000);
}

async function insertAnalytics(
  client: PoolClient,
  categoryIds: Map<string, string>,
  authorIds: Map<string, string>,
  homepageVersionId: string,
): Promise<void> {
  const published = articles.filter((article) => article.status === "PUBLISHED");
  const dayWeights = [0.72, 0.81, 0.9, 0.98, 1.06, 1.15, 1.29];
  const sourceWeights = [
    ["SEARCH", 0.42],
    ["SOCIAL", 0.27],
    ["DIRECT", 0.18],
    ["REFERRAL", 0.09],
    ["INTERNAL", 0.04],
  ] as const;

  for (const article of published) {
    for (let day = 0; day < 7; day += 1) {
      const bucket = bucketStart(day);
      const views = Math.round((article.viewsBase / 7) * dayWeights[day]!);
      const impressions = Math.round((article.homepageBase / 7) * dayWeights[day]!);
      const clicks = Math.round(impressions * (0.09 + (Number(article.key) % 5) * 0.006));
      await client.query(
        `insert into analytics_content_daily (
          bucket_start, content_item_id, published_version_id, article_views,
          gallery_opens, gallery_image_views, video_impressions,
          homepage_impressions, homepage_clicks
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (bucket_start, content_item_id, published_version_id)
        do update set article_views = excluded.article_views,
          gallery_opens = excluded.gallery_opens,
          gallery_image_views = excluded.gallery_image_views,
          video_impressions = excluded.video_impressions,
          homepage_impressions = excluded.homepage_impressions,
          homepage_clicks = excluded.homepage_clicks`,
        [
          bucket,
          articleId(article),
          versionId(article),
          views,
          Math.round(views * 0.06),
          Math.round(views * 0.18),
          article.category === "video" ? Math.round(views * 0.32) : Math.round(views * 0.03),
          impressions,
          clicks,
        ],
      );
      await client.query(
        `insert into analytics_category_daily
          (bucket_start, primary_category_id, content_item_id, article_views)
         values ($1, $2, $3, $4)
         on conflict (bucket_start, primary_category_id, content_item_id)
         do update set article_views = excluded.article_views`,
        [bucket, categoryIds.get(article.category), articleId(article), views],
      );
      await client.query(
        `insert into analytics_author_daily
          (bucket_start, author_id, content_item_id, article_views)
         values ($1, $2, $3, $4)
         on conflict (bucket_start, author_id, content_item_id)
         do update set article_views = excluded.article_views`,
        [bucket, authorIds.get(article.author), articleId(article), views],
      );
      for (const [source, weight] of sourceWeights) {
        await client.query(
          `insert into analytics_source_daily
            (bucket_start, traffic_source, referrer_host, content_item_id, event_count)
           values ($1, $2, $3, $4, $5)
           on conflict (bucket_start, traffic_source, referrer_host, content_item_id)
           do update set event_count = excluded.event_count`,
          [
            bucket,
            source,
            source === "SEARCH" ? "google.com" : source === "SOCIAL" ? "instagram.com" : null,
            articleId(article),
            Math.max(1, Math.round(views * weight)),
          ],
        );
      }
    }
  }

  const homepageSlots = ["LEAD", "SUPPORT_1", "SUPPORT_2", "FEATURED_1", "FEATURED_2", "FEATURED_3", "FEATURED_4", "FEATURED_5"] as const;
  for (const [position, slot] of homepageSlots.entries()) {
    const article = articles[position]!;
    for (let day = 0; day < 7; day += 1) {
      const impressions = Math.round((article.homepageBase / 7) * dayWeights[day]!);
      const clicks = Math.round(impressions * (0.1 + position * 0.004));
      await client.query(
        `insert into analytics_homepage_slot_daily
          (bucket_start, homepage_version_id, placement, position, content_item_id, impressions, clicks)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (bucket_start, homepage_version_id, placement, position, content_item_id)
         do update set impressions = excluded.impressions, clicks = excluded.clicks`,
        [
          bucketStart(day),
          homepageVersionId,
          slot,
          position + 1,
          articleId(article),
          impressions,
          clicks,
        ],
      );
    }
  }

  await client.query(
    `insert into analytics_aggregation_checkpoints
      (job_name, last_successful_through, last_started_at, last_completed_at, last_error_safe_summary, last_quality)
     values ($1, $2, now() - interval '15 minutes', now() - interval '10 minutes', null, '{}'::jsonb)
     on conflict (job_name) do update set
       last_successful_through = excluded.last_successful_through,
       last_started_at = excluded.last_started_at,
       last_completed_at = excluded.last_completed_at,
       last_error_safe_summary = null,
       last_quality = '{}'::jsonb`,
    [ANALYTICS_JOB_NAME, bucketStart(7)],
  );
}

async function main(): Promise<void> {
  const url = databaseUrl();
  assertLocalDatabase(url);
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await cleanup(client);
    const { categoryIds, authorIds } = await upsertTaxonomy(client);
    const staffUserId = await actorId(client);
    await insertContent(client, categoryIds, authorIds, staffUserId);
    await insertAttention(client, staffUserId);
    const homepageVersionId = await insertHomepage(client, staffUserId);
    await insertAnalytics(client, categoryIds, authorIds, homepageVersionId);
    await client.query("commit");
    process.stdout.write("Presentation demo data seeded for local database.\n");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
