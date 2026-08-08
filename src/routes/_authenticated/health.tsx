import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeHealthReport, checkMedicationInteractions } from "@/lib/health.functions";
import { LEVEL_LABEL, REVIEW_LINE, type AlertLevel } from "@/lib/health-rules";
import { HealthSafetyBanner } from "@/components/HealthSafetyBanner";
import {
  ShieldCheck,
  Upload,
  FileText,
  Trash2,
  Bell,
  BellOff,
  Info,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Lock,
  CalendarClock,
  Pill,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/health")({
  component: HealthPage,
  head: () => ({
    meta: [
      { title: "Health & Safety Reports | NutriMind AI" },
      {
        name: "description",
        content:
          "Upload blood reports privately, see calm review-level alerts from validated rules, and keep diet and training plans safe.",
      },
      { property: "og:title", content: "Health & Safety Reports | NutriMind AI" },
      {
        property: "og:description",
        content: "Private health-report uploads with explainable, non-diagnostic safety checks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const REPORT_TYPES = [
  { v: "blood_panel", l: "Complete blood panel" },
  { v: "thyroid", l: "Thyroid panel" },
  { v: "metabolic", l: "Metabolic / diabetes panel" },
  { v: "lipid", l: "Lipid profile" },
  { v: "liver", l: "Liver function" },
  { v: "kidney", l: "Kidney function" },
  { v: "vitamin", l: "Vitamin panel" },
  { v: "other", l: "Other health document" },
];

const PROGRAMS = [
  { v: "athlete_performance", l: "Athlete performance program" },
  { v: "weight_management", l: "Weight management program" },
  { v: "teen_growth", l: "Teen growth & development" },
  { v: "clinical_nutrition", l: "Condition-aware nutrition" },
];
const REGIONS = ["global", "IN", "EU", "US", "UK", "AE"];

const levelStyle: Record<AlertLevel, { chip: string; icon: typeof Info }> = {
  information: { chip: "bg-primary/10 text-primary border-primary/30", icon: Info },
  caution: { chip: "bg-warning/10 text-warning border-warning/40", icon: AlertTriangle },
  urgent: { chip: "bg-destructive/10 text-destructive border-destructive/50", icon: ShieldAlert },
};

function fileToDataUrl(f: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function HealthPage() {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeHealthReport);
  const medCheck = useServerFn(checkMedicationInteractions);
  const fileRef = useRef<HTMLInputElement>(null);

  const [reportType, setReportType] = useState("blood_panel");
  const [title, setTitle] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [reminder, setReminder] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [medResult, setMedResult] = useState<string | null>(null);

  const { data: consent } = useQuery({
    queryKey: ["health-consent"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("health_consents")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["health-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("health_reports")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: flags } = useQuery({
    queryKey: ["health-flags"],
    queryFn: async () => {
      const { data } = await supabase
        .from("health_flags")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: requirements } = useQuery({
    queryKey: ["report-requirements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("program_report_requirements")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const setConsent = useMutation({
    mutationFn: async (granted: boolean) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = {
        user_id: u.user.id,
        granted,
        scope: "health_document_ai_extraction",
        granted_at: granted ? new Date().toISOString() : null,
        revoked_at: granted ? null : new Date().toISOString(),
      };
      if (consent?.id) {
        const { error } = await supabase
          .from("health_consents")
          .update(payload)
          .eq("id", consent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("health_consents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, granted) => {
      qc.invalidateQueries({ queryKey: ["health-consent"] });
      toast.success(
        granted
          ? "Consent granted. You can withdraw it any time."
          : "Consent withdrawn. No new documents will be read.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = async (file: File) => {
    if (!consent?.granted)
      return toast.error("Please give consent before uploading a health document.");
    if (file.size > 20 * 1024 * 1024) return toast.error("File is larger than 20MB.");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("health-reports")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from("health_reports")
        .insert({
          user_id: u.user.id,
          title: title.trim() || file.name,
          report_type: reportType,
          report_date: reportDate || null,
          review_date: reviewDate || null,
          reminder_enabled: reminder,
          file_path: path,
          file_mime: file.type,
          upload_status: "uploaded",
        })
        .select()
        .single();
      if (insErr) throw insErr;

      qc.invalidateQueries({ queryKey: ["health-reports"] });
      toast.info("Uploaded. Reading the document…");

      const dataUrl = await fileToDataUrl(file);
      await analyze({ data: { reportId: row.id, fileData: dataUrl, mime: file.type, reportType } });

      qc.invalidateQueries({ queryKey: ["health-reports"] });
      qc.invalidateQueries({ queryKey: ["health-flags"] });
      qc.invalidateQueries({ queryKey: ["safety-status"] });
      setOpenId(row.id);
      setTitle("");
      toast.success("Values transcribed. Please check them against your paper report.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeReport = useMutation({
    mutationFn: async (r: { id: string; file_path: string | null }) => {
      if (r.file_path) await supabase.storage.from("health-reports").remove([r.file_path]);
      await supabase.from("health_flags").delete().eq("report_id", r.id);
      const { error } = await supabase.from("health_reports").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-reports"] });
      qc.invalidateQueries({ queryKey: ["health-flags"] });
      qc.invalidateQueries({ queryKey: ["safety-status"] });
      toast.success("Report and its extracted values deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleReminder = useMutation({
    mutationFn: async (r: { id: string; reminder_enabled: boolean }) => {
      const { error } = await supabase
        .from("health_reports")
        .update({ reminder_enabled: !r.reminder_enabled })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health-reports"] }),
  });

  const markReviewed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("health_reports")
        .update({ reviewed_by_professional: true, blocks_plan: false })
        .eq("id", id);
      if (error) throw error;
      await supabase
        .from("health_flags")
        .update({ acknowledged: true, blocks_diet: false, blocks_training: false })
        .eq("report_id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-reports"] });
      qc.invalidateQueries({ queryKey: ["health-flags"] });
      qc.invalidateQueries({ queryKey: ["safety-status"] });
      toast.success("Marked as reviewed by a professional. Personalised plans are active again.");
    },
  });

  const addRequirement = useMutation({
    mutationFn: async (v: { program: string; region: string; days: number; reminder: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const due = new Date(Date.now() + v.days * 86400000).toISOString().slice(0, 10);
      const { error } = await supabase.from("program_report_requirements").insert({
        user_id: u.user.id,
        program: v.program,
        region: v.region,
        countdown_days: v.days,
        due_date: due,
        daily_reminder: v.reminder,
        required: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-requirements"] });
      qc.invalidateQueries({ queryKey: ["safety-status"] });
      toast.success("Requirement created. General guidance stays available while it is pending.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRequirement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("program_report_requirements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-requirements"] });
      qc.invalidateQueries({ queryKey: ["safety-status"] });
    },
  });

  const [reqProgram, setReqProgram] = useState(PROGRAMS[0].v);
  const [reqRegion, setReqRegion] = useState("global");
  const [reqDays, setReqDays] = useState(10);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs text-primary">
          <Lock className="h-3 w-3" /> Private by default
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold">Health &amp; safety</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Upload a blood report or other health document to check whether any value deserves
          professional review. NutriMind does not diagnose disease, never prescribes and never
          changes medication. Extracted values can be incorrect — always compare them with your
          original report.
        </p>
      </header>

      <HealthSafetyBanner context="all" />

      {/* Consent */}
      <section className="glass-strong rounded-3xl p-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Consent &amp; what we use
        </div>
        <ul className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
          <li>· The document is stored in private storage only you can open.</li>
          <li>· AI reads it once, only to transcribe printed numbers into a table.</li>
          <li>
            · Whether a value needs review is decided by fixed, published reference ranges — not by
            the AI.
          </li>
          <li>
            · Your age and sex from your profile are compared with the report to catch mix-ups.
          </li>
          <li>· No diagnosis, prescription or medicine change is ever produced.</li>
          <li>· You can delete any report, its file and its extracted values at any time.</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {consent?.granted ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Consent granted
              </span>
              <button
                onClick={() => setConsent.mutate(false)}
                className="rounded-full border border-border px-4 py-2 text-xs hover:bg-muted"
              >
                Withdraw consent
              </button>
            </>
          ) : (
            <button
              onClick={() => setConsent.mutate(true)}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground glow-neon"
            >
              I understand — give consent
            </button>
          )}
        </div>
      </section>

      {/* Upload */}
      <section className="glass-strong rounded-3xl p-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Upload className="h-4 w-4 text-accent" /> Upload a report
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-xs">
            <span className="text-muted-foreground">Report type</span>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="text-muted-foreground">Title (optional)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder="e.g. Annual check-up"
              className="mt-1 w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="text-muted-foreground">Report date</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="text-muted-foreground">Review / expiry date</span>
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={reminder}
            onChange={(e) => setReminder(e.target.checked)}
            className="accent-primary"
          />
          Remind me when the review date approaches
        </label>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <button
          disabled={busy || !consent?.granted}
          onClick={() => fileRef.current?.click()}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Reading document…" : "Choose PDF or photo"}
        </button>
        {!consent?.granted && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Give consent above to enable uploads.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Supported: PDF blood reports and clear photos/scans, up to 20MB.
        </p>
      </section>

      {/* Reports */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Your reports</h2>
        {(reports ?? []).length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
            No reports uploaded yet.
          </div>
        ) : (
          (reports ?? []).map((r) => {
            const lvl = (r.alert_level as AlertLevel) ?? "information";
            const S = levelStyle[lvl] ?? levelStyle.information;
            const Icon = S.icon;
            const extracted = (r.extracted ?? {}) as {
              values?: {
                label: string;
                value: number;
                unit: string | null;
                source_text?: string | null;
              }[];
              legibility?: string;
              notes?: string;
            };
            const missing = (r.missing_fields ?? []) as string[];
            const mismatches = (r.profile_mismatches ?? []) as {
              field: string;
              report: string;
              profile: string;
              note: string;
            }[];
            const rFlags = (flags ?? []).filter((f) => f.report_id === r.id);
            const open = openId === r.id;
            return (
              <article key={r.id} className="glass rounded-3xl p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {REPORT_TYPES.find((t) => t.v === r.report_type)?.l ?? r.report_type}
                      {r.report_date ? ` · ${r.report_date}` : ""}
                      {r.review_date ? ` · review by ${r.review_date}` : ""}
                      {` · ${r.upload_status}`}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${S.chip}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {LEVEL_LABEL[lvl]}
                  </span>
                  <button
                    onClick={() =>
                      toggleReminder.mutate({ id: r.id, reminder_enabled: r.reminder_enabled })
                    }
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                    aria-label={r.reminder_enabled ? "Disable reminders" : "Enable reminders"}
                  >
                    {r.reminder_enabled ? (
                      <Bell className="h-4 w-4 text-primary" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => removeReport.mutate({ id: r.id, file_path: r.file_path })}
                    className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete report"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setOpenId(open ? null : r.id)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
                    aria-expanded={open}
                  >
                    {open ? "Hide" : "Details"}
                  </button>
                </div>

                {r.summary && <p className="mt-3 text-xs text-muted-foreground">{r.summary}</p>}

                {open && (
                  <div className="mt-4 space-y-4">
                    {rFlags.length > 0 && (
                      <div className="space-y-2">
                        {rFlags.map((f) => {
                          const fl = (f.level as AlertLevel) ?? "information";
                          const FS = levelStyle[fl] ?? levelStyle.information;
                          const FI = FS.icon;
                          return (
                            <div
                              key={f.id}
                              className={`rounded-2xl border p-3 ${FS.chip.replace("text-", "text-")}`}
                            >
                              <div className="flex items-center gap-2 text-xs font-semibold">
                                <FI className="h-3.5 w-3.5" /> {f.title}
                              </div>
                              <p className="mt-1 text-[11px] opacity-90">{f.message}</p>
                              {(f.blocks_diet || f.blocks_training) && (
                                <p className="mt-1 text-[11px] font-medium">
                                  Personalised{" "}
                                  {f.blocks_diet && f.blocks_training
                                    ? "diet and training"
                                    : f.blocks_diet
                                      ? "diet"
                                      : "training"}{" "}
                                  recommendations are paused. {REVIEW_LINE}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(extracted.values ?? []).length > 0 && (
                      <div className="overflow-x-auto rounded-2xl border border-border/60">
                        <table className="w-full text-xs">
                          <caption className="sr-only">Values transcribed from {r.title}</caption>
                          <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                            <tr>
                              <th className="p-2">Value</th>
                              <th className="p-2">Result</th>
                              <th className="p-2">Read from</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(extracted.values ?? []).map((v, i) => (
                              <tr key={i} className="border-t border-border/40">
                                <td className="p-2">{v.label}</td>
                                <td className="p-2 font-mono">
                                  {v.value} {v.unit ?? ""}
                                </td>
                                <td className="p-2 text-muted-foreground">
                                  {v.source_text ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      {missing.length > 0 && (
                        <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            Missing information
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {missing.join(", ")}
                          </p>
                        </div>
                      )}
                      {mismatches.length > 0 && (
                        <div className="rounded-2xl border border-warning/40 bg-warning/5 p-3">
                          <div className="text-[10px] uppercase tracking-widest text-warning">
                            Possible mismatch
                          </div>
                          <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                            {mismatches.map((m, i) => (
                              <li key={i}>
                                {m.field}: report says {m.report}, profile says {m.profile}.{" "}
                                {m.note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {!r.reviewed_by_professional && (
                      <button
                        onClick={() => markReviewed.mutate(r.id)}
                        className="rounded-full border border-primary/40 px-4 py-2 text-xs text-primary hover:bg-primary/10"
                      >
                        A doctor has reviewed this report
                      </button>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      AI transcription can misread numbers. Values here are not a diagnosis and must
                      be confirmed against your original report and with a qualified doctor.
                    </p>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* Program requirements */}
      <section className="glass-strong rounded-3xl p-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-accent" /> Program report requirements
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Some specialised programs ask for a recent report. Configure it per program and region.
          While a requirement is pending, only the specialised plan waits — general wellness
          guidance stays available.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            value={reqProgram}
            onChange={(e) => setReqProgram(e.target.value)}
            className="rounded-xl border border-border bg-background/50 px-3 py-2 text-sm"
          >
            {PROGRAMS.map((p) => (
              <option key={p.v} value={p.v}>
                {p.l}
              </option>
            ))}
          </select>
          <select
            value={reqRegion}
            onChange={(e) => setReqRegion(e.target.value)}
            className="rounded-xl border border-border bg-background/50 px-3 py-2 text-sm"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Countdown
            <input
              type="number"
              min={1}
              max={60}
              value={reqDays}
              onChange={(e) => setReqDays(Number(e.target.value))}
              className="w-20 rounded-xl border border-border bg-background/50 px-3 py-2 text-sm"
            />{" "}
            days
          </label>
          <button
            onClick={() =>
              addRequirement.mutate({
                program: reqProgram,
                region: reqRegion,
                days: reqDays,
                reminder: true,
              })
            }
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Add requirement
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {(requirements ?? []).map((q) => {
            const daysLeft = q.due_date
              ? Math.ceil((new Date(q.due_date + "T00:00:00").getTime() - Date.now()) / 86400000)
              : null;
            return (
              <div
                key={q.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-background/30 p-3 text-xs"
              >
                <span className="font-semibold">
                  {PROGRAMS.find((p) => p.v === q.program)?.l ?? q.program}
                </span>
                <span className="text-muted-foreground">{q.region}</span>
                <span
                  className={
                    daysLeft !== null && daysLeft <= 1 ? "text-warning" : "text-muted-foreground"
                  }
                >
                  {q.satisfied_by
                    ? "Satisfied"
                    : daysLeft === 1
                      ? "Report review is due tomorrow."
                      : daysLeft !== null
                        ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                        : "No due date"}
                </span>
                {q.daily_reminder && !q.satisfied_by && (
                  <span className="text-primary">Daily reminder on</span>
                )}
                <button
                  onClick={() => removeRequirement.mutate(q.id)}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  aria-label="Remove requirement"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Medication interactions */}
      <section className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Pill className="h-4 w-4 text-muted-foreground" /> Medication interaction checker
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Available only when a licensed clinical drug-interaction database is connected.
        </p>
        <button
          onClick={async () => setMedResult((await medCheck({ data: undefined as never })).reason)}
          className="mt-3 rounded-full border border-border px-4 py-2 text-xs hover:bg-muted"
        >
          Check availability
        </button>
        {medResult && (
          <p className="mt-3 rounded-2xl border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">
            {medResult}
          </p>
        )}
      </section>

      <p className="pb-6 text-[11px] text-muted-foreground">
        NutriMind is not a substitute for a qualified doctor, sports physician or physiotherapist.
        If you have pain, injury, severe fatigue or any concerning symptom, stop and seek
        professional care.
      </p>
    </div>
  );
}
