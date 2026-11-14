import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const allowed = new Set(["auth", "businesses", "public", "health"]);

async function proxy(
  request: NextRequest,
  context: {
    params: Promise<{ path: string[] }>;
  },
) {
  const { path } = await context.params;

  if (
    !allowed.has(path[0]) ||
    path.some((part) => part === "." || part === ".." || part.includes("/"))
  ) {
    return Response.json({ message: "API route not found" }, { status: 404 });
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");

    const host = request.headers.get("host") || request.nextUrl.host;

    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      request.nextUrl.protocol.replace(":", "");

    const expected = process.env.FRONTEND_ORIGIN || `${protocol}://${host}`;

    if (origin !== expected) {
      return Response.json(
        { message: "Request origin is not allowed." },
        { status: 403 },
      );
    }
  }

  const upstream = (
    process.env.PAYBRIDGE_API_URL || "http://localhost:4000/v1"
  ).replace(/\/+$/, "");

  const headers = new Headers({
    Accept: "application/json",
  });

  const cookie = request.cookies
    .getAll()
    .filter((item) => item.name === "pb_access" || item.name === "pb_refresh")
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const contentType = request.headers.get("content-type");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const idempotencyKey = request.headers.get("idempotency-key");

  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  try {
    const result = await fetch(
      `${upstream}/${path
        .map(encodeURIComponent)
        .join("/")}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        redirect: "manual",
        cache: "no-store",

        ...(!["GET", "HEAD"].includes(request.method)
          ? { body: await request.text() }
          : {}),

        signal: AbortSignal.timeout(60_000),
      },
    );

    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
    });

    responseHeaders.set(
      "Content-Type",
      result.headers.get("content-type") || "application/json",
    );

    for (const value of result.headers.getSetCookie()) {
      if (!/^pb_(access|refresh)=/.test(value)) {
        continue;
      }

      let cookieValue = value.replace(/;\s*Domain=[^;]+/gi, "");

      if (process.env.NODE_ENV !== "production") {
        cookieValue = cookieValue.replace(/;\s*Secure/gi, "");
      }

      responseHeaders.append("Set-Cookie", cookieValue);
    }

    if (result.status >= 300 && result.status < 400) {
      return Response.json(
        {
          message: "Unexpected API redirect. Please try again.",
        },
        { status: 502 },
      );
    }

    return new Response(result.status === 204 ? null : result.body, {
      status: result.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        message: "PayBridge is taking longer than expected. Please try again.",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as DELETE,
  proxy as PUT,
};
