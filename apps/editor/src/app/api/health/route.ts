export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "editor",
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
