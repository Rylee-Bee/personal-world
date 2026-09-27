/**
 * "Ask {room} to…": the room's own actions that aren't tied to one need
 * (for example Hive Works' "Re-check the tickets"). They come from the
 * row's `actions` list (the room's GET /room/actions, passed through by
 * GET /api/rooms). Actions that answer a need (approve, decline,
 * answer-decision) are offered on the need itself, not here.
 *
 * A write (`writes` true or missing: fail closed) is only offered to
 * someone who may approve; a read-only action is offered to everyone.
 * A press sends the action with a fresh Idempotency-Key, says
 * "Asking…" (static), then shows the room's receipt in its own words.
 * An action with `fields` (a small form the server checked, e.g.
 * Hive Works' Riff: words, bees, a door) opens that form first. When
 * the room offers a `crew` view, a choice whose value is one of its
 * crew shows that member's face beside their name (decorative).
 */
import { useEffect, useRef, useState } from "react";
import { useRoomAction, useRoomView } from "../../data/hooks";
import type { HiveCrewView, RoomActionReceipt, RoomOffer, RoomRow } from "../../data/contract";
import { formatTime, idempotencyKey, LINK_BASE, roomItemUrl, TEXTAREA } from "./format";
import { formBody, formReady, offerLabel, type FormValues } from "./choices";

const SECTION_TITLE =
  "mb-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-text-muted)]";
const SMALL = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";
const QUIET_BUTTON = `${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)] disabled:opacity-60`;
const PRIMARY_BUTTON = `${LINK_BASE} bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)] disabled:opacity-60`;
const PICKED = `${LINK_BASE} border border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm_soft)] text-[var(--pw-text-primary)] disabled:opacity-60`;


/** A crew member's face on a choice chip; hidden if it doesn't load. */
function ChipFace({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      className="mr-[var(--pw-spacing-xs)] h-[28px] w-[28px] shrink-0 rounded-full border border-[var(--pw-border-subtle)] object-cover"
    />
  );
}

function OfferForm({
  row,
  offer,
  label,
  onSend,
  onCancel,
}: {
  row: RoomRow;
  offer: RoomOffer;
  label: string;
  onSend: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const fields = offer.fields ?? [];
  // Faces for choices, from the room's own crew view when it has one
  // (a 404 simply means no faces).
  const hasChoices = fields.some((f) => f.kind !== "text");
  const crewView = useRoomView<HiveCrewView>(row.id, "crew", undefined, hasChoices);
  const faces = new Map<string, string>();
  for (const b of crewView.data?.data?.crew ?? []) {
    const url = b.face_url ? roomItemUrl(row, b.face_url) : null;
    if (url) faces.set(b.bee, url);
  }
  const [values, setValues] = useState<FormValues>({});
  const firstRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => firstRef.current?.focus(), []);
  const set = (name: string, v: string | string[]) => setValues((all) => ({ ...all, [name]: v }));
  const firstText = fields.find((f) => f.kind === "text")?.name;

  return (
    <form
      aria-label={label}
      className="mt-[var(--pw-spacing-sm)] flex flex-col gap-[var(--pw-spacing-md)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (formReady(fields, values)) onSend(formBody(fields, values));
      }}
    >
      {fields.map((f) => {
        const id = `offer-${offer.id}-${f.name}`;
        if (f.kind === "text") {
          const ref = f.name === firstText ? firstRef : undefined;
          return (
            <div key={f.name} className="flex flex-col gap-[var(--pw-spacing-xs)]">
              <label htmlFor={id} className={SMALL}>
                {f.required ? f.label : `${f.label} (optional)`}
              </label>
              <textarea
                ref={ref}
                id={id}
                rows={3}
                maxLength={f.max_length}
                value={(values[f.name] as string) ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                className={TEXTAREA}
              />
            </div>
          );
        }
        const many = f.kind === "choices";
        const picked = many ? ((values[f.name] as string[]) ?? []) : [(values[f.name] as string) ?? ""];
        const full = many && f.max !== undefined && picked.length >= f.max;
        const legend = many && f.max ? `${f.label} (pick up to ${f.max})` : f.label;
        return (
          <fieldset key={f.name} className="flex flex-col gap-[var(--pw-spacing-xs)]">
            <legend className={`${SMALL} mb-[var(--pw-spacing-xs)]`}>{legend}</legend>
            <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
              {(f.options ?? []).map((o) => {
                const on = picked.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && full}
                    onClick={() =>
                      many
                        ? set(f.name, on ? picked.filter((p) => p !== o.value) : [...picked, o.value])
                        : set(f.name, on ? "" : o.value)
                    }
                    className={on ? PICKED : QUIET_BUTTON}
                  >
                    {faces.has(o.value) ? <ChipFace src={faces.get(o.value) as string} /> : null}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        <button type="submit" disabled={!formReady(fields, values)} className={PRIMARY_BUTTON}>
          Send
        </button>
        <button type="button" onClick={onCancel} className={QUIET_BUTTON}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function RoomOffers({
  row,
  roomName,
  offers,
  headingId,
}: {
  row: RoomRow;
  roomName: string;
  offers: RoomOffer[];
  headingId: string;
}) {
  const action = useRoomAction();
  const [asking, setAsking] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ label: string; receipt: RoomActionReceipt } | null>(null);
  const [filling, setFilling] = useState<RoomOffer | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (asking || receipt) statusRef.current?.focus();
  }, [asking, receipt]);

  const send = (offer: RoomOffer, body: Record<string, unknown> = {}) => {
    const label = offerLabel(offer);
    setReceipt(null);
    setFilling(null);
    setAsking(label);
    action.mutate(
      { roomId: row.id, actionId: offer.id, body, key: idempotencyKey() },
      {
        onSuccess: (r) => {
          setAsking(null);
          setReceipt({ label, receipt: r });
        },
        onError: () => {
          setAsking(null);
          setReceipt({
            label,
            receipt: { action_id: offer.id, ok: false, summary: "Couldn’t reach Worlds, so nothing changed.", changed: [], at: null },
          });
        },
      },
    );
  };

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className={SECTION_TITLE}>
        {`Ask ${roomName} to`}
      </h3>
      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        {offers.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={asking !== null}
            aria-expanded={o.fields?.length ? filling?.id === o.id : undefined}
            onClick={() => {
              if (!o.fields?.length) return send(o);
              setReceipt(null);
              setFilling(filling?.id === o.id ? null : o);
            }}
            className={QUIET_BUTTON}
          >
            {offerLabel(o)}
          </button>
        ))}
      </div>
      {filling && !asking && (
        <OfferForm
          key={filling.id}
          row={row}
          offer={filling}
          label={offerLabel(filling)}
          onSend={(body) => send(filling, body)}
          onCancel={() => setFilling(null)}
        />
      )}
      {asking && (
        <p ref={statusRef} tabIndex={-1} role="status" className={`${SMALL} mt-[var(--pw-spacing-sm)] focus:outline-none`}>
          {`Asking… Waiting for ${roomName} to answer “${asking}”.`}
        </p>
      )}
      {!asking && receipt && (
        <p
          ref={statusRef}
          tabIndex={-1}
          role={receipt.receipt.ok ? "status" : "alert"}
          className={`${SMALL} mt-[var(--pw-spacing-sm)] focus:outline-none`}
        >
          <span className="font-semibold text-[var(--pw-text-primary)]">
            {receipt.receipt.ok ? "Done. " : "Nothing changed. "}
          </span>
          {receipt.receipt.summary}
          {receipt.receipt.ok && receipt.receipt.at ? ` (${formatTime(receipt.receipt.at)})` : ""}
        </p>
      )}
    </section>
  );
}
