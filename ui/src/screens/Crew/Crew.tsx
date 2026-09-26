/**
 * Crew — the person's own companions (owner decision 2026-09-25:
 * companions are user-owned; owner 2026-09-26: its own page, reached
 * from Settings). Design: canvas boards Spec-Crew / Spec-CrewAdd.
 *
 * What lives here, all per person and private (GET/POST/PATCH/DELETE
 * /api/crew, PUT /api/rooms/{id}/keeper):
 *
 *   - the crew: the drawn starter crew plus anyone the person added.
 *     Starters can be renamed or hidden, never deleted (the server
 *     refuses with 409); people's own companions can be deleted.
 *   - pictures: PNG, JPEG or WebP up to 5 MB. Until there is one, a
 *     companion wears the crew commbadge with their initial.
 *   - who keeps which room: at most one keeper per room, or none (the
 *     room shows its own emblem).
 *
 * Companions are presentation. Nothing here changes a room's status or
 * what Worlds says is true; the copy says so where it matters.
 *
 * Accessibility: one h1, an h2 per section, an h3 per companion; every
 * control is a labelled native control or a react-aria button at the
 * 44px minimum; results and failures are announced in words
 * (role=status / role=alert); no motion.
 */
import { useId, useState, type FormEvent } from "react";
import {
  useAddCrew,
  useCrew,
  useDeleteCrew,
  usePatchCrew,
  usePrefs,
  usePutRoomKeeper,
  useRooms,
  useUploadCrewPortrait,
} from "../../data/hooks";
import type { CrewEntry, RoomRow } from "../../data/contract";
import { crewAssetUrl } from "../../data/types";
import { describeError } from "../../data/errors";
import { WorldButton } from "../../components/WorldButton";
import { CompanionFace } from "../../components/crew/CompanionFace";

const PORTRAIT_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;

const SECTION =
  "mb-[var(--pw-spacing-2xl)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]";
const SECTION_TITLE =
  "mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-secondary)]";
const CONTROL =
  "w-full min-h-[var(--pw-targets-minimum)] rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-md)] py-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";
const LABEL =
  "mb-[var(--pw-spacing-xs)] block text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]";
const HINT = "mt-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]";
const NOTE = "text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]";

function roomName(row: RoomRow): string {
  return row.room?.name?.trim() || row.id;
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

// ─── The page ────────────────────────────────────────────────────────

export function Crew({ onBack }: { onBack: () => void }) {
  const crewQuery = useCrew();
  const roomsQuery = useRooms();
  const prefsQuery = usePrefs();
  const crew = crewQuery.data?.data ?? [];
  const rows = roomsQuery.data?.data ?? [];
  const chosen = prefsQuery.data?.data?.companion_id ?? null;
  const visible = crew.filter((c) => !c.hidden);
  const hidden = crew.filter((c) => c.hidden);

  const roomsKeptBy = (id: string) =>
    rows.filter((r) => r.keeper?.id === id).map(roomName);

  return (
    <main
      id="main-content"
      aria-label="Your crew"
      className="relative z-10 max-w-[1080px] p-[var(--pw-spacing-xl)] md:p-[var(--pw-spacing-3xl)]"
    >
      <header className="mb-[var(--pw-spacing-2xl)] flex flex-col gap-[var(--pw-spacing-sm)]">
        <WorldButton variant="ghost" onPress={onBack} className="self-start">
          ← Back to Settings
        </WorldButton>
        <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Your crew
        </h1>
        <p className={`${NOTE} max-w-[60ch]`}>
          Companions you’ve invited aboard. Add your own, and choose which rooms, if
          any, each one keeps. A room doesn’t need a companion, and a companion
          doesn’t need a room.
        </p>
      </header>

      <section
        aria-label="About Sol"
        className="mb-[var(--pw-spacing-2xl)] flex items-center gap-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-lg)]"
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/crew/256/sol-mark.webp`}
          alt=""
          aria-hidden="true"
          className="h-16 w-16 shrink-0 object-contain"
        />
        <p className={NOTE}>
          <span className="font-semibold text-[var(--pw-text-primary)]">Sol</span> is
          Worlds’ own mark, in menus and little moments all over, and the planet on
          every crew commbadge. She isn’t a companion: she has no voice of her own and
          doesn’t keep a room.
        </p>
      </section>

      <section aria-labelledby="crew-list-heading" className={SECTION}>
        <h2 id="crew-list-heading" className={SECTION_TITLE}>
          Companions · {visible.length}
        </h2>
        {crewQuery.isPending ? (
          <p role="status" className={NOTE}>
            Gathering your crew…
          </p>
        ) : crewQuery.isError ? (
          <div className="flex flex-col items-start gap-[var(--pw-spacing-sm)]">
            <p role="alert" className={NOTE}>
              Couldn’t load your crew right now. Nothing has changed.
            </p>
            <WorldButton onPress={() => void crewQuery.refetch()}>Try again</WorldButton>
          </div>
        ) : visible.length === 0 ? (
          <p className={NOTE}>
            No companions aboard. Worlds speaks as the Assistant, its plain voice.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-[var(--pw-spacing-md)] min-[760px]:grid-cols-2">
            {visible.map((entry) => (
              <CompanionCard
                key={entry.id}
                entry={entry}
                keeps={roomsKeptBy(entry.id)}
                isChosen={chosen === entry.id}
              />
            ))}
          </ul>
        )}

        {hidden.length > 0 && <HiddenCrew entries={hidden} />}
      </section>

      <KeepersSection rows={rows} crew={visible} roomsPending={roomsQuery.isPending} roomsError={roomsQuery.isError} />

      <AddCompanion />
    </main>
  );
}

// ─── One companion ───────────────────────────────────────────────────

function CompanionCard({
  entry,
  keeps,
  isChosen,
}: {
  entry: CrewEntry;
  keeps: string[];
  isChosen: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const patch = usePatchCrew();
  const headingId = `crew-${entry.id}-name`;
  const starter = entry.source === "starter";

  return (
    <li
      aria-labelledby={headingId}
      className="flex flex-col gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]"
    >
      <div className="flex items-center gap-[var(--pw-spacing-md)]">
        <CompanionFace name={entry.name} portrait={crewAssetUrl(entry.portrait_asset)} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--pw-spacing-xs)]">
          <div className="flex flex-wrap items-baseline gap-x-[var(--pw-spacing-sm)]">
            <h3
              id={headingId}
              className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]"
            >
              {entry.name}
            </h3>
            <span className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.06em] text-[var(--pw-text-secondary)]">
              {starter ? "Starter crew" : "Added by you"}
            </span>
          </div>
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            {[
              keeps.length > 0 ? `Keeps ${listWords(keeps)}` : "No room · free to wander",
              isChosen ? "your companion" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {entry.blurb && (
            <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
              {entry.blurb}
            </p>
          )}
        </div>
      </div>

      {patch.isError && (
        <p role="alert" className={NOTE}>
          {describeError(patch.error, `Couldn’t update ${entry.name}.`)}
        </p>
      )}

      {editing ? (
        <EditCompanion entry={entry} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
          <WorldButton onPress={() => setEditing(true)} aria-label={`Edit ${entry.name}`}>
            Edit
          </WorldButton>
          <WorldButton
            variant="ghost"
            isDisabled={patch.isPending}
            onPress={() => patch.mutate({ id: entry.id, hidden: true })}
            aria-label={`Hide ${entry.name}`}
          >
            Hide
          </WorldButton>
        </div>
      )}
    </li>
  );
}

function EditCompanion({ entry, onDone }: { entry: CrewEntry; onDone: () => void }) {
  const ids = useId();
  const [name, setName] = useState(entry.name);
  const [blurb, setBlurb] = useState(entry.blurb ?? "");
  const [voice, setVoice] = useState(entry.voice_label ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const patch = usePatchCrew();
  const upload = useUploadCrewPortrait();
  const remove = useDeleteCrew();

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    patch.mutate(
      {
        id: entry.id,
        name: name.trim(),
        blurb: blurb.trim() || null,
        voice_label: voice.trim() || null,
      },
      { onSuccess: onDone },
    );
  };

  const choosePicture = async (file: File | undefined) => {
    setFileNote(null);
    if (!file) return;
    if (!PORTRAIT_TYPES.includes(file.type)) {
      setFileNote("That file isn’t a PNG, JPEG or WebP picture.");
      return;
    }
    if (file.size > PORTRAIT_MAX_BYTES) {
      setFileNote("That picture is over 5 MB. Try a smaller copy.");
      return;
    }
    try {
      const data = await readFileAsBase64(file);
      upload.mutate(
        { id: entry.id, contentType: file.type, dataBase64: data },
        { onSuccess: () => setFileNote(`New picture saved for ${entry.name}.`) },
      );
    } catch (err) {
      setFileNote(describeError(err, "Couldn’t read that file."));
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-[var(--pw-spacing-md)] border-t border-[var(--pw-border-subtle)] pt-[var(--pw-spacing-md)]">
      <div>
        <label htmlFor={`${ids}-name`} className={LABEL}>
          Name
        </label>
        <input
          id={`${ids}-name`}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={CONTROL}
        />
      </div>
      <div>
        <label htmlFor={`${ids}-blurb`} className={LABEL}>
          A few words about them
        </label>
        <input
          id={`${ids}-blurb`}
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          aria-describedby={`${ids}-blurb-hint`}
          className={CONTROL}
        />
        <p id={`${ids}-blurb-hint`} className={HINT}>
          Optional. Shown on their card as flavour, never as facts.
        </p>
      </div>
      <div>
        <label htmlFor={`${ids}-voice`} className={LABEL}>
          How they sound
        </label>
        <input
          id={`${ids}-voice`}
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          aria-describedby={`${ids}-voice-hint`}
          placeholder="gentle and a little dreamy"
          className={CONTROL}
        />
        <p id={`${ids}-voice-hint`} className={HINT}>
          Optional. Changes how they phrase things. Facts, statuses and uncertainty
          stay exact in every voice.
        </p>
      </div>
      <div>
        <label htmlFor={`${ids}-picture`} className={LABEL}>
          Picture
        </label>
        <input
          id={`${ids}-picture`}
          type="file"
          accept={PORTRAIT_TYPES.join(",")}
          onChange={(e) => void choosePicture(e.target.files?.[0])}
          aria-describedby={`${ids}-picture-hint`}
          className={`${CONTROL} file:mr-[var(--pw-spacing-md)] file:min-h-[36px] file:rounded-[var(--pw-radius-sm)] file:border-0 file:bg-[var(--pw-accent-warm)] file:px-[var(--pw-spacing-md)] file:text-[var(--pw-surface-void)]`}
        />
        <p id={`${ids}-picture-hint`} className={HINT}>
          PNG, JPEG or WebP, up to 5 MB. Square works best. Saved as soon as you pick
          it, and only visible to you.
        </p>
        {(fileNote || upload.isPending || upload.isError) && (
          <p role={upload.isError ? "alert" : "status"} className={`${NOTE} mt-1`}>
            {upload.isPending
              ? "Saving the picture…"
              : upload.isError
                ? describeError(upload.error, "Couldn’t save that picture.")
                : fileNote}
          </p>
        )}
      </div>

      {(patch.isError || remove.isError) && (
        <p role="alert" className={NOTE}>
          {describeError(patch.error ?? remove.error, `Couldn’t update ${entry.name}.`)}
        </p>
      )}

      <div className="flex flex-wrap gap-[var(--pw-spacing-sm)]">
        <WorldButton type="submit" variant="primary" isDisabled={patch.isPending || !name.trim()}>
          {patch.isPending ? "Saving…" : "Save"}
        </WorldButton>
        <WorldButton onPress={onDone}>Cancel</WorldButton>
        {entry.source === "user" &&
          (confirmDelete ? (
            <>
              <WorldButton
                variant="primary"
                isDisabled={remove.isPending}
                onPress={() => remove.mutate(entry.id)}
              >
                {`Yes, delete ${entry.name}`}
              </WorldButton>
              <WorldButton variant="ghost" onPress={() => setConfirmDelete(false)}>
                Keep them
              </WorldButton>
              <p role="status" className={`${NOTE} basis-full`}>
                {`Deleting ${entry.name} removes their picture and leaves any rooms they kept with no keeper. This can’t be undone.`}
              </p>
            </>
          ) : (
            <WorldButton variant="ghost" onPress={() => setConfirmDelete(true)}>
              Delete…
            </WorldButton>
          ))}
      </div>
    </form>
  );
}

function HiddenCrew({ entries }: { entries: CrewEntry[] }) {
  const [open, setOpen] = useState(false);
  const patch = usePatchCrew();
  return (
    <div className="mt-[var(--pw-spacing-lg)] flex flex-col gap-[var(--pw-spacing-sm)]">
      <WorldButton
        variant="ghost"
        aria-expanded={open}
        aria-controls="crew-hidden"
        onPress={() => setOpen(!open)}
        className="self-start"
      >
        {`${entries.length} hidden · ${open ? "Hide list" : "Show list"}`}
      </WorldButton>
      <ul id="crew-hidden" hidden={!open} className="flex flex-col gap-[var(--pw-spacing-sm)]">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-[var(--pw-spacing-md)]">
            <CompanionFace name={entry.name} portrait={crewAssetUrl(entry.portrait_asset)} size="sm" dim />
            <span className="flex-1 text-[var(--pw-text-primary)]">{entry.name}</span>
            <WorldButton
              isDisabled={patch.isPending}
              onPress={() => patch.mutate({ id: entry.id, hidden: false })}
              aria-label={`Bring ${entry.name} back`}
            >
              Bring back
            </WorldButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Who keeps which room ────────────────────────────────────────────

function KeepersSection({
  rows,
  crew,
  roomsPending,
  roomsError,
}: {
  rows: RoomRow[];
  crew: CrewEntry[];
  roomsPending: boolean;
  roomsError: boolean;
}) {
  const put = usePutRoomKeeper();
  return (
    <section aria-labelledby="crew-keepers-heading" className={SECTION}>
      <h2 id="crew-keepers-heading" className={SECTION_TITLE}>
        Who keeps each room
      </h2>
      <p className={`${NOTE} mb-[var(--pw-spacing-lg)]`}>
        A room has at most one keeper. Choosing a new one moves the room; the old
        keeper stays in your crew. A keeper never changes what a room reports.
      </p>
      {roomsPending ? (
        <p role="status" className={NOTE}>
          Checking your rooms…
        </p>
      ) : roomsError ? (
        <p role="alert" className={NOTE}>
          Couldn’t load your rooms right now, so keepers can’t be changed yet.
        </p>
      ) : rows.length === 0 ? (
        <p className={NOTE}>No rooms are set up yet.</p>
      ) : (
        <div className="flex flex-col gap-[var(--pw-spacing-md)]">
          {rows.map((row) => {
            const id = `keeper-${row.id}`;
            const current = row.keeper?.id ?? "";
            // A keeper who is hidden stays assignable-as-current, named.
            const options = crew.some((c) => c.id === current) || !row.keeper
              ? crew
              : [...crew, { id: row.keeper.id, name: `${row.keeper.name} (hidden)` } as CrewEntry];
            return (
              <div
                key={row.id}
                className="grid grid-cols-1 items-center gap-[var(--pw-spacing-xs)] min-[600px]:grid-cols-[200px_minmax(0,1fr)]"
              >
                <label htmlFor={id} className="font-medium text-[var(--pw-text-primary)]">
                  {roomName(row)}
                </label>
                <select
                  id={id}
                  value={current}
                  disabled={put.isPending}
                  onChange={(e) =>
                    put.mutate({ roomId: row.id, companionId: e.target.value || null })
                  }
                  className={CONTROL}
                >
                  <option value="">No keeper (the room’s own emblem)</option>
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
      {put.isError && (
        <p role="alert" className={`${NOTE} mt-[var(--pw-spacing-md)]`}>
          {describeError(put.error, "Couldn’t change that keeper. Nothing moved.")}
        </p>
      )}
      {put.isSuccess && (
        <p role="status" className={`${NOTE} mt-[var(--pw-spacing-md)]`}>
          {put.data?.data?.keeper
            ? `${put.data.data.keeper.name} now keeps ${roomName(
                rows.find((r) => r.id === put.data?.data?.room_id) ?? ({ id: put.data.data.room_id, room: null } as RoomRow),
              )}.`
            : "That room has no keeper now."}
        </p>
      )}
    </section>
  );
}

// ─── Add your own ────────────────────────────────────────────────────

function AddCompanion() {
  const ids = useId();
  const add = useAddCrew();
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [voice, setVoice] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdded(null);
    add.mutate(
      {
        name: name.trim(),
        ...(blurb.trim() ? { blurb: blurb.trim() } : {}),
        ...(voice.trim() ? { voice_label: voice.trim() } : {}),
      },
      {
        onSuccess: (res) => {
          setAdded(res.data?.name ?? name.trim());
          setName("");
          setBlurb("");
          setVoice("");
        },
      },
    );
  };

  return (
    <section aria-labelledby="crew-add-heading" className={SECTION}>
      <h2 id="crew-add-heading" className={SECTION_TITLE}>
        Add a companion
      </h2>
      <form onSubmit={submit} className="flex max-w-[640px] flex-col gap-[var(--pw-spacing-md)]">
        <p className={NOTE}>
          Only a name is required. Until you add a picture, they wear the crew
          commbadge with their initial.
        </p>
        <div>
          <label htmlFor={`${ids}-name`} className={LABEL}>
            Name
          </label>
          <input
            id={`${ids}-name`}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call them?"
            className={CONTROL}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-blurb`} className={LABEL}>
            A few words about them
          </label>
          <input
            id={`${ids}-blurb`}
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="Tends the garden; hums while working"
            className={CONTROL}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-voice`} className={LABEL}>
            How they sound
          </label>
          <input
            id={`${ids}-voice`}
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            placeholder="gentle and a little dreamy"
            className={CONTROL}
          />
        </div>
        <div className="flex flex-wrap items-center gap-[var(--pw-spacing-md)]">
          <WorldButton type="submit" variant="primary" isDisabled={add.isPending || !name.trim()}>
            {add.isPending ? "Adding…" : "Add to your crew"}
          </WorldButton>
          {add.isError && (
            <p role="alert" className={NOTE}>
              {describeError(add.error, "Couldn’t add them. Nothing was saved.")}
            </p>
          )}
          {added && !add.isError && (
            <p role="status" className={NOTE}>
              {`${added} is aboard. Add a picture or give them a room above.`}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
