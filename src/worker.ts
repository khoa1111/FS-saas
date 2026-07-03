interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") || url.pathname === "/ws") {
      return Response.json(
        {
          error: "API_NOT_MIGRATED_TO_WORKERS",
          message: "Felic Studio OS static client is deployed. The realtime/API backend still runs on the Express server until the D1/Durable Objects migration is completed."
        },
        { status: 501 }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
