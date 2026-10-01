import { http, HttpResponse } from "msw";
import { cards, homeBoard } from "./fixtures";

/** Handlers for GET /api/boards/home and GET /api/cards/{id}. Kept for tests once the real API lands. */
export const handlers = [
  http.get("/api/boards/home", () => HttpResponse.json(homeBoard)),
  http.get("/api/cards/:id", ({ params }) => {
    const card = cards[String(params.id)];
    return card ? HttpResponse.json(card) : HttpResponse.json({ detail: "not found" }, { status: 404 });
  }),
];
