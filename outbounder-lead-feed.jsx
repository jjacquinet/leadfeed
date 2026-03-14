import { useState, useRef, useEffect } from "react";

const LEADS = [
  {
    id: 1,
    name: "Marcus Rivera",
    title: "Director of Business Development",
    company: "Cloudbridge AI",
    companySize: "Series A · 45 employees",
    avatar: "MR",
    avatarColor: "#0891B2",
    dealStage: "Demo Scheduled",
    dealSize: "$24,000",
    icpFit: 91,
    priorityScore: 94,
    recommendedAction: "Respond to reply",
    rationale: "Replied 2 hours ago · asking about integrations",
    recommendedChannel: "email",
    hasUnread: true,
    email: "marcus@cloudbridge.ai",
    phone: "(415) 555-0187",
    linkedin: "linkedin.com/in/marcusrivera",
    location: "San Francisco, CA",
    leadSource: "LinkedIn Outbound",
    leadDate: "Mar 3, 2026",
    lastContacted: "2 hours ago",
    timeline: [
      { type: "email_received", date: "Today 10:23 AM", preview: "Hey John, this is looking really promising. Quick question — does your platform integrate with HubSpot? That's a dealbreaker for us.", from: "Marcus Rivera" },
      { type: "email_sent", date: "Fri 3/7 · 2:15 PM", preview: "Marcus, great chatting yesterday. As promised, here's a quick overview of how our platform handles multi-channel sequences. I've attached a one-pager that covers the key differentiators.", from: "You" },
      { type: "call", date: "Thu 3/6 · 3:00 PM", preview: "Connected · 15 min · Very engaged, wants to see HubSpot integration specifically. Demo scheduled for Thursday 3/13 at 2pm ET. He's evaluating us against Salesloft.", from: "You" },
      { type: "linkedin_received", date: "Tue 3/4 · 9:41 AM", preview: "Thanks for reaching out — yeah I'd be open to a quick call this week. What does Thursday look like?", from: "Marcus Rivera" },
      { type: "linkedin_sent", date: "Mon 3/3 · 11:20 AM", preview: "Hey Marcus, saw Cloudbridge just closed their Series A — congrats! We help companies like yours build predictable outbound pipelines. Would you be open to a quick chat?", from: "You" },
    ],
    notes: "HubSpot integration is critical. Demo Thursday 3/13 at 2pm ET. Evaluating us vs Salesloft.",
  },
  {
    id: 2,
    name: "Sarah Chen",
    title: "VP of Sales",
    company: "Nextera Solutions",
    companySize: "Series B · 120 employees",
    avatar: "SC",
    avatarColor: "#4F46E5",
    dealStage: "Contract Sent",
    dealSize: "$48,000",
    icpFit: 96,
    priorityScore: 97,
    recommendedAction: "Follow up on contract",
    rationale: "Contract sent 4 days ago · no response",
    recommendedChannel: "email",
    hasUnread: false,
    email: "sarah.chen@nextera.io",
    phone: "(617) 555-0234",
    linkedin: "linkedin.com/in/sarahchen",
    location: "Boston, MA",
    leadSource: "SaaStr Conference",
    leadDate: "Feb 24, 2026",
    lastContacted: "4 days ago",
    timeline: [
      { type: "email_sent", date: "Mon 3/6 · 9:30 AM", preview: "Hi Sarah, just wanted to follow up on the contract I sent over last week. Let me know if you have any questions or if there's anything I can help move along on your end.", from: "You" },
      { type: "email_received", date: "Thu 3/2 · 4:12 PM", preview: "Looks great, send over the contract and I'll review with our legal team. Should have feedback by end of next week.", from: "Sarah Chen" },
      { type: "call", date: "Wed 3/1 · 2:00 PM", preview: "Connected · 22 min · Discussed pricing in detail, she's aligned on the multi-channel package. Legal team needs to review contract. Sarah is the decision maker but CFO signs off on anything over $40k.", from: "You" },
      { type: "linkedin_sent", date: "Mon 2/27 · 10:15 AM", preview: "Great meeting you at SaaStr — would love to continue our conversation about scaling your outbound. Mind if I send over some more details?", from: "You" },
      { type: "note", date: "Fri 2/24", preview: "Met at SaaStr booth. Very interested in multi-channel outreach. Budget approved for Q2. She mentioned they tried Outreach.io before and it didn't work for them.", from: "You" },
    ],
    notes: "Budget approved for Q2. Legal needs to review. Sarah is the decision maker but CFO signs off. Previously tried Outreach.io.",
  },
  {
    id: 3,
    name: "Priya Patel",
    title: "Head of Growth",
    company: "Vantage Health",
    companySize: "Series C · 300 employees",
    avatar: "PP",
    avatarColor: "#9333EA",
    dealStage: "Proposal Sent",
    dealSize: "$72,000",
    icpFit: 94,
    priorityScore: 91,
    recommendedAction: "Call to discuss proposal",
    rationale: "Proposal sent 6 days ago · 2 follow-ups unanswered",
    recommendedChannel: "call",
    hasUnread: false,
    email: "priya@vantagehealth.com",
    phone: "(212) 555-0391",
    linkedin: "linkedin.com/in/priyapatel",
    location: "New York, NY",
    leadSource: "Email Campaign",
    leadDate: "Feb 20, 2026",
    lastContacted: "4 days ago",
    timeline: [
      { type: "email_sent", date: "Thu 3/6 · 10:00 AM", preview: "Hi Priya, just bumping this to the top of your inbox — would love to get your thoughts on the proposal.", from: "You" },
      { type: "email_sent", date: "Tue 3/4 · 9:15 AM", preview: "Priya, following up on the proposal I sent over. Happy to walk through any questions or adjust the scope.", from: "You" },
      { type: "email_sent", date: "Tue 2/28 · 3:30 PM", preview: "As discussed, here's our proposal for Vantage Health. I've included the multi-channel package with analytics add-on.", from: "You" },
      { type: "call", date: "Mon 2/27 · 1:00 PM", preview: "Connected · 35 min · Deep dive on outbound needs. Expanding sales team 5 to 15 reps in Q2. Wants multi-channel + analytics. Reports directly to CEO.", from: "You" },
    ],
    notes: "Big opportunity. Reports to CEO. Expanding sales team 5→15 in Q2. Two email follow-ups unanswered — try calling.",
  },
  {
    id: 4,
    name: "James Whitfield",
    title: "CEO",
    company: "Relay Robotics",
    companySize: "Seed · 12 employees",
    avatar: "JW",
    avatarColor: "#DC2626",
    dealStage: "Conversation",
    dealSize: "$12,000",
    icpFit: 78,
    priorityScore: 82,
    recommendedAction: "Send LinkedIn follow-up",
    rationale: "Email unanswered 5 days · try original channel",
    recommendedChannel: "linkedin",
    hasUnread: false,
    email: "james@relayrobotics.com",
    phone: "(512) 555-0142",
    linkedin: "linkedin.com/in/jwhitfield",
    location: "Austin, TX",
    leadSource: "LinkedIn Outbound",
    leadDate: "Feb 27, 2026",
    lastContacted: "5 days ago",
    timeline: [
      { type: "email_sent", date: "Wed 3/5 · 11:00 AM", preview: "James, wanted to circle back on our conversation. Would a 15-min call this week work?", from: "You" },
      { type: "linkedin_received", date: "Fri 2/28 · 3:22 PM", preview: "Yeah this sounds interesting. Shoot me an email with more details?", from: "James Whitfield" },
      { type: "linkedin_sent", date: "Thu 2/27 · 2:45 PM", preview: "Hey James, congrats on the Relay launch! We help robotics companies build predictable outbound pipelines.", from: "You" },
    ],
    notes: "Small deal but CEO contact. Could grow as they scale. Originally engaged via LinkedIn.",
  },
  {
    id: 5,
    name: "Diana Morales",
    title: "SVP Marketing",
    company: "FinEdge Capital",
    companySize: "Growth · 500 employees",
    avatar: "DM",
    avatarColor: "#059669",
    dealStage: "Conversation",
    dealSize: "$36,000",
    icpFit: 88,
    priorityScore: 79,
    recommendedAction: "Send comparison doc",
    rationale: "Promised comparison doc on Friday call",
    recommendedChannel: "email",
    hasUnread: false,
    email: "diana.morales@finedge.com",
    phone: "(305) 555-0276",
    linkedin: "linkedin.com/in/dianamorales",
    location: "Miami, FL",
    leadSource: "Email Campaign",
    leadDate: "Mar 3, 2026",
    lastContacted: "3 days ago",
    timeline: [
      { type: "call", date: "Fri 3/7 · 3:00 PM", preview: "Connected · 18 min · Evaluating 2 other vendors (Salesloft, Apollo). Wants comparison doc. Decision by end of March.", from: "You" },
      { type: "email_received", date: "Wed 3/5 · 11:30 AM", preview: "Sure, let's do a call Friday afternoon. 3pm ET work?", from: "Diana Morales" },
      { type: "email_sent", date: "Tue 3/4 · 9:45 AM", preview: "Diana, thanks for the response. Would love to hop on a quick call. Do you have 20 min this week?", from: "You" },
      { type: "email_received", date: "Mon 3/3 · 2:15 PM", preview: "Hi John, we're actively looking at outbound solutions for our BD team. Can you tell me more?", from: "Diana Morales" },
    ],
    notes: "Evaluating us vs Salesloft and Apollo. Needs comparison doc. Decision end of March.",
  },
  {
    id: 6,
    name: "Tom Bradley",
    title: "Operations Manager",
    company: "Greenline Logistics",
    companySize: "SMB · 80 employees",
    avatar: "TB",
    avatarColor: "#B45309",
    dealStage: "Lead",
    dealSize: "$8,000",
    icpFit: 65,
    priorityScore: 58,
    recommendedAction: "Send intro email",
    rationale: "Met at conference last week · no outreach yet",
    recommendedChannel: "email",
    hasUnread: false,
    email: "tom.bradley@greenline.com",
    phone: "(773) 555-0198",
    linkedin: "linkedin.com/in/tombradley",
    location: "Chicago, IL",
    leadSource: "Supply Chain Expo",
    leadDate: "Mar 7, 2026",
    lastContacted: "Never",
    timeline: [
      { type: "note", date: "Fri 3/7", preview: "Met at Supply Chain Expo booth. Interested in email outreach for logistics network. Small budget, quick close potential.", from: "You" },
    ],
    notes: "Quick close potential but small deal. Email only to start.",
  },
];

const stageConfig = {
  "Lead": { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  "Conversation": { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  "Demo Scheduled": { bg: "#F5F3FF", text: "#7C3AED", border: "#C4B5FD" },
  "Proposal Sent": { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Contract Sent": { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
};

const timelineConfig = {
  email_sent: { color: "#6366F1", label: "You sent email", bg: "#EEF2FF" },
  email_received: { color: "#22C55E", label: "Received email", bg: "#F0FDF4" },
  call: { color: "#F59E0B", label: "Call", bg: "#FFFBEB" },
  linkedin_sent: { color: "#0A66C2", label: "You sent LinkedIn", bg: "#EFF6FF" },
  linkedin_received: { color: "#22C55E", label: "Received LinkedIn", bg: "#F0FDF4" },
  note: { color: "#94A3B8", label: "Note", bg: "#F8FAFC" },
};

const f = "'DM Sans', sans-serif";
const m = "'DM Mono', monospace";

function Ico({ type, size = 14 }) {
  const s = size;
  const icons = {
    email: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13L2 4"/></svg>,
    call: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
    linkedin: <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
    text: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    note: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
    send: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    check: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
    clock: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
    archive: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
    refresh: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
    chevron: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>,
    sparkle: <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M10 2L11.5 7.5L17 9L11.5 10.5L10 16L8.5 10.5L3 9L8.5 7.5L10 2Z"/><path d="M18 12L19 15L22 16L19 17L18 20L17 17L14 16L17 15L18 12Z"/><path d="M5 17L5.5 18.5L7 19L5.5 19.5L5 21L4.5 19.5L3 19L4.5 18.5L5 17Z"/></svg>,
  };
  return icons[type] || null;
}

function getDraft(lead, channel) {
  if (channel === "note") return "";
  if (channel === "call") return "";
  if (channel === "text") return "Hi " + lead.name.split(" ")[0] + ", this is John from Outbounder. Just following up — do you have a few minutes to chat this week?";
  if (channel === "linkedin") {
    if (lead.id === 4) return "Hey James — sent you an email last week but figured I'd follow up here since this is where we originally connected. Would love to find 15 min to walk you through how we've helped other robotics companies build outbound. Any interest?";
    return "Hey " + lead.name.split(" ")[0] + " — wanted to follow up here. Do you have a few minutes to connect this week?";
  }
  // email
  const drafts = {
    1: "Hey Marcus,\n\nGreat question — yes, we have a native HubSpot integration that syncs contacts, activities, and deal stages bi-directionally.\n\nI can walk you through it in detail during our demo Thursday. Want me to make that a focus area?\n\nJohn",
    2: "Hi Sarah,\n\nHope your week is going well. Wanted to check in on the contract — have you had a chance to review it with your legal team?\n\nHappy to hop on a quick call if any questions came up.\n\nBest,\nJohn",
    3: "",
    4: "James, wanted to circle back — would a 15-min call this week work? Happy to walk through how we've helped other robotics startups build outbound.\n\nJohn",
    5: "Hi Diana,\n\nAs promised, I put together that comparison breakdown. Attached is a one-pager showing how we stack up against Salesloft and Apollo across the areas you mentioned.\n\nLet me know if you'd like to walk through it.\n\nBest,\nJohn",
    6: "Hey Tom,\n\nGreat meeting you at the Supply Chain Expo last week. Enjoyed our conversation about scaling your outreach.\n\nWould you be open to a 15-minute call this week to explore if we're a fit?\n\nJohn",
  };
  return drafts[lead.id] || "";
}

function ResizeHandle({ onMouseDown, direction = "col" }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: direction === "col" ? "5px" : "100%",
        height: direction === "col" ? "100%" : "5px",
        cursor: direction === "col" ? "col-resize" : "row-resize",
        background: hovered ? "#CBD5E1" : "transparent",
        transition: "background 0.15s",
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}
    >
      <div style={{
        position: "absolute",
        [direction === "col" ? "left" : "top"]: "50%",
        [direction === "col" ? "top" : "left"]: "50%",
        transform: "translate(-50%, -50%)",
        width: direction === "col" ? "3px" : "24px",
        height: direction === "col" ? "24px" : "3px",
        borderRadius: "2px",
        background: hovered ? "#94A3B8" : "transparent",
        transition: "background 0.15s",
      }} />
    </div>
  );
}

export default function LeadFeed() {
  const [selectedId, setSelectedId] = useState(1);
  const [activeChannel, setActiveChannel] = useState("email");
  const [draft, setDraft] = useState(() => getDraft(LEADS[0], "email"));
  const [completedIds, setCompletedIds] = useState(new Set());
  const [showSnooze, setShowSnooze] = useState(false);
  const [filter, setFilter] = useState("all");
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(260);
  const dragging = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      if (dragging.current === "left") {
        const newW = Math.min(Math.max(e.clientX - rect.left, 200), 500);
        setLeftWidth(newW);
      } else if (dragging.current === "right") {
        const newW = Math.min(Math.max(rect.right - e.clientX, 200), 450);
        setRightWidth(newW);
      }
    };
    const handleMouseUp = () => { dragging.current = null; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, []);

  const selected = LEADS.find(l => l.id === selectedId);
  const isCompleted = completedIds.has(selectedId);
  const active = LEADS.filter(l => !completedIds.has(l.id));
  const done = LEADS.filter(l => completedIds.has(l.id));
  const needsReply = active.filter(l => l.hasUnread).length;

  const handleSend = () => {
    setCompletedIds(prev => new Set([...prev, selectedId]));
    setShowSnooze(true);
  };

  const handleSnooze = () => {
    setShowSnooze(false);
    const next = active.find(l => l.id !== selectedId);
    if (next) {
      const nextChannel = next.recommendedChannel === "call" ? "call" : "email";
      setSelectedId(next.id);
      setActiveChannel(nextChannel);
      setDraft(getDraft(next, nextChannel));
    }
  };

  const stage = selected ? (stageConfig[selected.dealStage] || stageConfig["Lead"]) : null;

  const getList = () => {
    if (filter === "done") return done;
    if (filter === "unread") return active.filter(l => l.hasUnread);
    return [...active, ...done];
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: f, background: "#F8F9FB", overflow: "hidden" }}>
      {/* Page Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.2px" }}>Daily Lead Feed</h1>
            <span style={{ fontSize: "11.5px", color: "#94A3B8", fontWeight: 500 }}>Tue, Mar 10 · Prioritized 8:00 AM</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {[
              { l: "Tasks", v: active.length, c: "#0F172A" },
              { l: "Needs Reply", v: needsReply, c: "#6366F1" },
              { l: "Done", v: completedIds.size, c: "#22C55E" },
              { l: "Snoozed", v: 263, c: "#94A3B8" },
            ].map(s => (
              <div key={s.l} style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <span style={{ fontSize: "15px", fontWeight: 700, color: s.c, fontFamily: m }}>{s.v}</span>
                <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500 }}>{s.l}</span>
              </div>
            ))}
            <button style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#fff", color: "#64748B", fontSize: "12px", cursor: "pointer", fontFamily: f, fontWeight: 500 }}>
              <Ico type="refresh" size={12} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Three Panels */}
      <div ref={containerRef} style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT - Queue */}
        <div style={{ width: leftWidth + "px", flexShrink: 0, background: "#fff", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #F3F4F6", display: "flex", gap: "3px" }}>
            {[{ k: "all", l: "All" }, { k: "unread", l: "Replies" }, { k: "done", l: "Done" }].map(fi => (
              <button key={fi.k} onClick={() => setFilter(fi.k)} style={{
                padding: "4px 10px", borderRadius: "5px", border: "none",
                background: filter === fi.k ? "#F1F5F9" : "transparent",
                color: filter === fi.k ? "#1E293B" : "#94A3B8",
                fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: f,
              }}>{fi.l}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {getList().map(lead => {
              const sel = lead.id === selectedId;
              const d = completedIds.has(lead.id);
              const st = stageConfig[lead.dealStage];
              return (
                <div key={lead.id} onClick={() => {
                  const nextChannel = lead.recommendedChannel === "call" ? "call" : lead.recommendedChannel;
                  setSelectedId(lead.id);
                  setActiveChannel(nextChannel);
                  setDraft(getDraft(lead, nextChannel));
                  setShowSnooze(false);
                }} style={{
                  padding: "11px 12px", cursor: "pointer",
                  background: sel ? "#F8FAFC" : "#fff",
                  borderLeft: sel ? "3px solid #1E293B" : "3px solid transparent",
                  borderBottom: "1px solid #F5F6F8",
                  opacity: d ? 0.45 : 1,
                }}>
                  <div style={{ display: "flex", gap: "9px" }}>
                    <div style={{
                      width: "34px", height: "34px", borderRadius: "8px",
                      background: d ? "#F0FDF4" : lead.avatarColor + "12",
                      color: d ? "#22C55E" : lead.avatarColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: 700, flexShrink: 0,
                    }}>{d ? <Ico type="check" /> : lead.avatar}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "1px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0F172A" }}>{lead.name}</span>
                        {lead.hasUnread && !d && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6366F1" }} />}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "3px" }}>{lead.title} · {lead.company}</div>
                      <div style={{ fontSize: "11px", color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "3px" }}><span style={{ color: "#7DD3FC", display: "flex", flexShrink: 0 }}><Ico type="sparkle" size={10} /></span>{lead.recommendedAction}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px", flexShrink: 0 }}>
                      <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 5px", borderRadius: "3px", background: st.bg, color: st.text, border: `1px solid ${st.border}`, whiteSpace: "nowrap" }}>{lead.dealStage}</span>
                      <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#64748B", fontFamily: m }}>{lead.dealSize}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <ResizeHandle onMouseDown={() => { dragging.current = "left"; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }} />

        {/* CENTER - Activity + Compose */}
        {selected && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#FAFBFD", overflow: "hidden", minWidth: 0 }}>
            {/* Header */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid #E8ECF0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "7px", background: selected.avatarColor + "15", color: selected.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700 }}>{selected.avatar}</div>
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#0F172A" }}>{selected.name}</div>
                  <div style={{ fontSize: "11.5px", color: "#64748B" }}>{selected.title} at {selected.company}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button onClick={() => setShowSnooze(true)} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#fff", color: "#64748B", fontSize: "11.5px", cursor: "pointer", fontFamily: f, fontWeight: 500 }}><Ico type="clock" size={12} /> Snooze</button>
                <button style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #FEE2E2", background: "#FFF5F5", color: "#DC2626", fontSize: "11.5px", cursor: "pointer", fontFamily: f, fontWeight: 500 }}><Ico type="archive" size={12} /> Archive</button>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
              {selected.timeline.map((ev, i) => {
                const cfg = timelineConfig[ev.type];
                const isIn = ev.type.includes("received");
                return (
                  <div key={i} style={{ marginBottom: "14px", display: "flex", flexDirection: "column", alignItems: isIn ? "flex-start" : "flex-end" }}>
                    <div style={{ fontSize: "10.5px", color: "#94A3B8", marginBottom: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Ico type={ev.type.includes("email") ? "email" : ev.type.includes("linkedin") ? "linkedin" : ev.type === "call" ? "call" : "note"} size={11} />
                      {cfg.label} · {ev.date}
                    </div>
                    <div style={{
                      maxWidth: "80%", padding: "10px 14px",
                      borderRadius: isIn ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                      background: isIn ? "#fff" : cfg.bg,
                      border: `1px solid ${isIn ? "#E5E7EB" : cfg.color + "20"}`,
                      fontSize: "12.5px", color: "#334155", lineHeight: 1.5,
                    }}>{ev.preview}</div>
                  </div>
                );
              })}
            </div>

            {/* Snooze Bar */}
            {showSnooze && (
              <div style={{ padding: "10px 18px", background: "#F0FDF4", borderTop: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ color: "#22C55E", display: "flex" }}><Ico type="check" /></span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#166534" }}>Done!</span>
                <span style={{ fontSize: "11px", color: "#166534" }}>Snooze:</span>
                {["Tomorrow", "3 Days", "1 Week", "2 Weeks", "1 Month", "3 Months"].map(o => (
                  <button key={o} onClick={() => handleSnooze(o)} style={{ padding: "3px 8px", borderRadius: "5px", border: "1px solid #BBF7D0", background: "#fff", color: "#166534", fontSize: "10.5px", fontWeight: 500, cursor: "pointer", fontFamily: f }}>{o}</button>
                ))}
                <button onClick={() => handleSnooze("ai")} style={{ padding: "3px 10px", borderRadius: "5px", border: "none", background: "#166534", color: "#fff", fontSize: "10.5px", fontWeight: 600, cursor: "pointer", fontFamily: f, marginLeft: "auto" }}>Let AI Decide</button>
              </div>
            )}

            {/* Compose */}
            {!isCompleted && (
              <div style={{ borderTop: "1px solid #E8ECF0", background: "#fff" }}>
                {/* AI Suggestion Banner */}
                <div style={{ padding: "8px 14px", background: "#F0F9FF", borderBottom: "1px solid #E0F2FE", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#0369A1", display: "flex", flexShrink: 0 }}><Ico type="sparkle" size={14} /></span>
                  <span style={{ fontSize: "12px", color: "#0369A1", fontWeight: 500 }}>{selected.recommendedAction} via {selected.recommendedChannel}</span>
                  <span style={{ fontSize: "11px", color: "#7DD3FC" }}>·</span>
                  <span style={{ fontSize: "11.5px", color: "#0C4A6E", fontStyle: "italic" }}>{selected.rationale}</span>
                </div>
                {/* Channel Tabs */}
                <div style={{ display: "flex", borderBottom: "1px solid #F3F4F6" }}>
                  {[
                    { k: "email", l: "Email" },
                    { k: "call", l: "Call" },
                    { k: "linkedin", l: "LinkedIn" },
                    { k: "text", l: "Text" },
                    { k: "note", l: "Note" },
                  ].map(ch => (
                    <button key={ch.k} onClick={() => { setActiveChannel(ch.k); setDraft(getDraft(selected, ch.k)); }} style={{
                      display: "flex", alignItems: "center", gap: "4px",
                      padding: "8px 14px", border: "none",
                      borderBottom: activeChannel === ch.k ? "2px solid #1E293B" : "2px solid transparent",
                      background: "transparent",
                      color: activeChannel === ch.k ? "#1E293B" : "#94A3B8",
                      fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: f,
                    }}>
                      <Ico type={ch.k === "call" ? "call" : ch.k} size={12} /> {ch.l}
                      {ch.k === selected.recommendedChannel && <span style={{ color: "#2563EB", display: "flex" }}><Ico type="sparkle" size={10} /></span>}
                    </button>
                  ))}
                </div>

                {activeChannel !== "call" ? (
                  <div style={{ padding: "10px 14px" }}>
                    <textarea value={draft} onChange={e => setDraft(e.target.value)}
                      placeholder={activeChannel === "note" ? "Add a note..." : `Write ${activeChannel} message...`}
                      style={{ width: "100%", minHeight: "80px", padding: "8px 10px", borderRadius: "6px", border: "1px solid #E5E7EB", fontSize: "12.5px", fontFamily: f, color: "#334155", lineHeight: 1.5, resize: "vertical", outline: "none", background: "#FAFBFD", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                      <button onClick={handleSend} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 16px", borderRadius: "5px", border: "none", background: "#1E293B", color: "#fff", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: f }}>
                        <Ico type="send" size={12} /> {activeChannel === "note" ? "Save Note" : "Send"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "8px" }}>Log Call Outcome</div>
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "8px" }}>
                      {["Connected", "Voicemail", "No Answer", "Meeting Booked"].map(o => (
                        <button key={o} onClick={handleSend} style={{ padding: "6px 12px", borderRadius: "5px", border: "1px solid #E5E7EB", background: "#fff", color: "#334155", fontSize: "11.5px", fontWeight: 500, cursor: "pointer", fontFamily: f }}>{o}</button>
                      ))}
                    </div>
                    <textarea placeholder="Call notes..." style={{ width: "100%", minHeight: "45px", padding: "8px 10px", borderRadius: "6px", border: "1px solid #E5E7EB", fontSize: "12.5px", fontFamily: f, color: "#334155", resize: "vertical", outline: "none", background: "#FAFBFD", boxSizing: "border-box" }} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <ResizeHandle onMouseDown={() => { dragging.current = "right"; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }} />

        {/* RIGHT - Contact Details */}
        {selected && (
          <div style={{ width: rightWidth + "px", flexShrink: 0, background: "#fff", overflowY: "auto" }}>
            <div style={{ padding: "18px 14px", textAlign: "center", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ width: "50px", height: "50px", borderRadius: "12px", background: selected.avatarColor + "15", color: selected.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, margin: "0 auto 8px" }}>{selected.avatar}</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "1px" }}>{selected.name}</div>
              <div style={{ fontSize: "11.5px", color: "#64748B" }}>{selected.title}</div>
              <div style={{ fontSize: "11.5px", color: "#94A3B8" }}>{selected.company}</div>
              <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginTop: "8px" }}>
                <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: stage.bg, color: stage.text, border: `1px solid ${stage.border}` }}>{selected.dealStage}</span>
                <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: "#F1F5F9", color: "#475569" }}>{selected.dealSize}</span>
              </div>
            </div>

            {/* Contact */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ fontSize: "9.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "8px" }}>Contact</div>
              {[
                { l: "EMAIL", v: selected.email, t: "email" },
                { l: "PHONE", v: selected.phone, t: "call" },
                { l: "LINKEDIN", v: selected.linkedin.replace("linkedin.com/in/", ""), t: "linkedin" },
                { l: "LOCATION", v: selected.location },
              ].map(item => (
                <div key={item.l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
                  <div>
                    <div style={{ fontSize: "9.5px", color: "#94A3B8", fontWeight: 600, letterSpacing: "0.3px" }}>{item.l}</div>
                    <div style={{ fontSize: "12px", color: "#334155", fontWeight: 500 }}>{item.v}</div>
                  </div>
                  {item.t && (
                    <button onClick={() => setActiveChannel(item.t)} style={{ width: "26px", height: "26px", borderRadius: "5px", border: "1px solid #E5E7EB", background: "#FAFBFD", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B", flexShrink: 0 }}>
                      <Ico type={item.t} size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Details */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ fontSize: "9.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "8px" }}>Details</div>
              {[
                { l: "ICP FIT", v: selected.icpFit + "%", bar: true },
                { l: "PRIORITY", v: selected.priorityScore + " / 100" },
                { l: "COMPANY", v: selected.companySize },
                { l: "SOURCE", v: selected.leadSource },
                { l: "LEAD DATE", v: selected.leadDate },
                { l: "LAST TOUCH", v: selected.lastContacted },
              ].map(item => (
                <div key={item.l} style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: item.bar ? "3px" : 0 }}>
                    <span style={{ fontSize: "9.5px", color: "#94A3B8", fontWeight: 600 }}>{item.l}</span>
                    <span style={{ fontSize: "11px", color: "#334155", fontWeight: 600, fontFamily: m }}>{item.v}</span>
                  </div>
                  {item.bar && (
                    <div style={{ height: "3px", borderRadius: "2px", background: "#F1F5F9" }}>
                      <div style={{ width: `${selected.icpFit}%`, height: "100%", borderRadius: "2px", background: selected.icpFit > 85 ? "#22C55E" : selected.icpFit > 70 ? "#F59E0B" : "#EF4444" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Notes */}
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: "9.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" }}>Notes</div>
              <div style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.55 }}>{selected.notes}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
