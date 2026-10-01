import { http, HttpResponse } from "msw";
import { createBoardServer } from "./board-server";
import { cards, needsYou } from "./fixtures";

/** The test board server: call boardServer.reset() between tests. */
export const boardServer = createBoardServer();

/** Handlers for the Home read API and the board write API. Kept for tests once the real API is the default. */
export const handlers = [
  http.get("/api/boards/home", () => HttpResponse.json(boardServer.display())),
  http.get("/api/needs-you", () => HttpResponse.json(needsYou)),
  http.get("/api/cards/:id", ({ params }) => {
    const card = cards[String(params.id)];
    return card ? HttpResponse.json(card) : HttpResponse.json({ detail: "not found" }, { status: 404 });
  }),
  http.get("/api/config/board/home", () => {
    const { body, etag } = boardServer.getConfig();
    return HttpResponse.json(body, { headers: { etag } });
  }),
  http.put("/api/config/board/home", async ({ request }) => {
    const r = boardServer.put(request.headers.get("if-match"), request.headers.get("x-csrf-token"), (await request.json()) as never);
    return HttpResponse.json(r.body as Record<string, unknown>, { status: r.status, headers: { etag: r.etag } });
  }),
];
