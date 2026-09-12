import { useState } from "react";
import TabBar from "./components/TabBar.jsx";

export default function App() {
  const [tab, setTab] = useState("practice");

  return (
    <div>
      <TabBar active={tab} onChange={setTab} />
      <p>current tab: {tab}</p>
    </div>
  );
}
