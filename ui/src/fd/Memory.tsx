import { useId } from "react";
import { Tabs, type TabDef } from "./Tabs";
import "./fd.css";

const NOTHING_YET = "Nothing kept yet.";

/** Memory: Kept, Later, Records, History, Find. Records waits for a person. */
export function Memory() {
  const searchId = useId();
  const tabs: TabDef[] = [
    { id: "kept", label: "Kept", panel: <p className="fd-sentence">{NOTHING_YET}</p> },
    { id: "later", label: "Later", panel: <p className="fd-sentence">{NOTHING_YET}</p> },
    {
      id: "records",
      label: "Records",
      panel: (
        <div className="fd-records">
          <button type="button" className="fd-btn">
            Confirm it's you
          </button>
          <p className="fd-sentence">Records stay locked until we know it's you.</p>
        </div>
      ),
    },
    { id: "history", label: "History", panel: <p className="fd-sentence">{NOTHING_YET}</p> },
    {
      id: "find",
      label: "Find",
      panel: (
        <div className="fd-find">
          <label htmlFor={searchId} className="fd-label">
            Search Memory
          </label>
          <input id={searchId} type="search" className="fd-input" />
          <p className="fd-sentence">Search runs on this device.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="fd-screen">
      <h1 className="fd-screen-title">Memory</h1>
      <Tabs label="Memory" tabs={tabs} />
    </div>
  );
}
