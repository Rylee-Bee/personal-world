import { Tabs, type TabDef } from "./Tabs";
import "./fd.css";

/**
 * Memory: Kept, Later, Records, History, Find. These are skeletons: no control that does nothing is shown
 * (the Records unlock and the search appear when Memory is wired up).
 */
export function Memory() {
  const tabs: TabDef[] = [
    { id: "kept", label: "Kept", panel: <p className="fd-sentence">Nothing kept yet. Things you choose to keep will be here.</p> },
    { id: "later", label: "Later", panel: <p className="fd-sentence">Nothing set aside for later.</p> },
    { id: "records", label: "Records", panel: <p className="fd-sentence">Records are locked. You will be asked to confirm it's you when they open.</p> },
    { id: "history", label: "History", panel: <p className="fd-sentence">No history yet.</p> },
    { id: "find", label: "Find", panel: <p className="fd-sentence">Search will work here once Memory is wired up. It will run on this device.</p> },
  ];

  return (
    <div className="fd-screen">
      <h1 className="fd-screen-title">Memory</h1>
      <Tabs label="Memory" tabs={tabs} />
    </div>
  );
}
