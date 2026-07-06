import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";

const FINAL_STATUS = "completed";
const FINAL_STATUS_ALT = "summary_generated";
const FAILURE_STATUS = "failed";
const FINISHED_STATUSES = [FINAL_STATUS, FINAL_STATUS_ALT];

const initialResult = {
  transcript_data: "",
  emotion_data: null,
  llm_output: null,
};

function formatLabel(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

const phaseIcons = {
  Queued: "⏳",
  Transcribing: "🎤",
  "Emotion Recognizing": "😊",
  "Summary Generating": "🧠",
  Completing: "✨",
  Completed: "✅",
};

const statusFlow = [
  { status: "started", label: "Started" },
  { status: "transcribed", label: "Transcribed" },
  { status: "emotion_analyzed", label: "Emotion Analyzed" },
  { status: "summary_generated", label: "Summary Generated" },
];

function iconForPhase(phase) {
  return phaseIcons[phase] || "⏳";
}

function formatPercentage(value) {
  if (typeof value !== "number") return "0%";

  let percent = value;
  if (value <= 1) {
    percent = value * 100;
  }

  percent = Math.round(percent);
  percent = Math.min(100, Math.max(0, percent));

  return `${percent}%`;
}

async function createFileFromPayload(payload) {
  if (!payload) return null;

  if (payload.file) {
    return payload.file;
  }

  if (payload.dataUrl) {
    const response = await fetch(payload.dataUrl);
    const uploadBlob = await response.blob();
    return new File([uploadBlob], payload.fileName || "recording.webm", {
      type: payload.type || uploadBlob.type || "video/webm",
    });
  }

  if (payload.data) {
    const data = payload.data;
    let byteArray = null;

    if (data instanceof ArrayBuffer) {
      byteArray = new Uint8Array(data);
    } else if (ArrayBuffer.isView(data)) {
      byteArray = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (Array.isArray(data)) {
      byteArray = new Uint8Array(data);
    }

    if (byteArray) {
      const blob = new Blob([byteArray], {
        type: payload.type || "video/webm",
      });
      return new File(
        [blob],
        payload.fileName || payload.name || "recording.webm",
        {
          type: payload.type || "video/webm",
        },
      );
    }
  }

  return null;
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [jobId, setJobId] = useState("");
  const [jobStatus, setJobStatus] = useState("idle");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("Select a video to start.");
  const [jobError, setJobError] = useState("");
  const [jobResult, setJobResult] = useState(initialResult);
  const [activeTab, setActiveTab] = useState("summary");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const pollingRef = useRef(null);
  const latestJobIdRef = useRef("");

  const summaryData = jobResult.llm_output;
  const emotionData = jobResult.emotion_data;
  const transcriptData = jobResult.transcript_data;
  const isFinished = FINISHED_STATUSES.includes(jobStatus);
  const isFailed = jobStatus === FAILURE_STATUS;
  const previewName = selectedFile ? selectedFile.name : "No video selected";

  const statusText = useMemo(() => {
    if (jobStatus === "idle") return "Idle";
    if (jobStatus === "queued") return "Queued";
    if (jobStatus === "started") return "Started";
    if (jobStatus === "transcribed") return "Transcribed";
    if (jobStatus === "emotion_analyzed") return "Emotion Analyzed";
    if (jobStatus === "summary_generated") return "Summary Generated";
    if (FINISHED_STATUSES.includes(jobStatus)) return "Completed";
    if (jobStatus === FAILURE_STATUS) return "Failed";
    return formatLabel(jobStatus);
  }, [jobStatus]);

  useEffect(() => {
    const handlePendingUpload = async (
      pendingPayload = window.__pendingUploadPayload,
    ) => {
      if (typeof window === "undefined") return;

      const pending = pendingPayload || window.__pendingUploadPayload;
      if (!pending) {
        console.log("[app] handlePendingUpload: no pending payload yet", {
          checkTime: new Date().toISOString(),
        });
        return;
      }

      console.log("[app] received pending upload payload", pending);
      const file = await createFileFromPayload(pending);
      if (!file) {
        console.log("[app] could not create File from payload");
        return;
      }

      console.log("[app] created file from payload", {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      window.__pendingUploadPayload = null;
      setSelectedFile(file);
      setJobError("");
      setJobMessage("Ready to submit the video job.");
      setJobStatus("idle");
      setJobProgress(0);
      setJobId("");
      setJobResult(initialResult);
      setActiveTab("summary");
      stopPolling();

      console.log("[app] updated UI with file, cleared retry loop");
    };

    const handlePayloadEvent = async (event) => {
      const pending = event?.detail;
      console.log("[app] payload event fired", {
        pending,
        hasDetail: !!pending,
      });
      if (!pending) {
        console.log("[app] payload event has no detail");
        return;
      }
      console.log("[app] setting window.__pendingUploadPayload and processing");
      window.__pendingUploadPayload = pending;
      await handlePendingUpload(pending);
    };

    const handleWindowMessage = async (event) => {
      const pending =
        event?.data?.type === "meeting-video-payload"
          ? event.data.payload
          : null;

      if (!pending) {
        return;
      }

      console.log("[app] received payload via postMessage", pending);
      window.__pendingUploadPayload = pending;
      await handlePendingUpload(pending);
    };

    const checkPayloadMarker = () => {
      const marker = document.getElementById("meetinglens-payload-marker");
      if (marker) {
        console.log("[app] found payload marker in DOM");
        marker.remove();
        if (window.__pendingUploadPayload) {
          void handlePendingUpload(window.__pendingUploadPayload);
        }
      }
    };

    // Add a global watcher to log any changes to window.__pendingUploadPayload
    const originalDefineProperty = Object.defineProperty;
    let lastPayload = null;
    const checkPayload = () => {
      const current = window.__pendingUploadPayload;
      if (current && current !== lastPayload) {
        console.log("[app] detected window.__pendingUploadPayload changed!", {
          timestamp: new Date().toISOString(),
          hasMeeting: !!current,
          size: current?.dataUrl?.length,
        });
        lastPayload = current;
        void handlePendingUpload(current);
      }
    };

    const retryLoop = window.setInterval(() => {
      checkPayload();
      checkPayloadMarker();
    }, 300);

    console.log("[app] useEffect mounted, checking for initial payload");
    void handlePendingUpload();
    window.addEventListener("meeting-video-payload", handlePayloadEvent);
    window.addEventListener("message", handleWindowMessage);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      window.clearInterval(retryLoop);
      window.removeEventListener("meeting-video-payload", handlePayloadEvent);
      window.removeEventListener("message", handleWindowMessage);
    };
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const updateJobState = (payload) => {
    if (!payload) return;

    setJobId(payload.id ?? latestJobIdRef.current);
    setJobStatus(payload.status ?? "queued");
    setJobProgress(typeof payload.progress === "number" ? payload.progress : 0);
    setJobMessage(payload.message ?? "");
    setJobError(payload.error ?? "");

    if (payload.result) {
      setJobResult({
        transcript_data: payload.result.transcript_data ?? "",
        emotion_data: payload.result.emotion_data ?? null,
        llm_output: payload.result.llm_output ?? null,
      });
    }

    if (
      FINISHED_STATUSES.includes(payload.status) ||
      payload.status === FAILURE_STATUS
    ) {
      stopPolling();
    }
  };

  const pollJob = async (targetJobId) => {
    const response = await fetch(`${API_BASE}/api/video/jobs/${targetJobId}`);
    if (!response.ok) {
      throw new Error("Unable to fetch job status.");
    }

    const payload = await response.json();
    if (latestJobIdRef.current !== targetJobId) {
      return;
    }

    updateJobState(payload);
  };

  const startPolling = (targetJobId) => {
    stopPolling();

    pollingRef.current = setInterval(() => {
      pollJob(targetJobId).catch((error) => {
        setJobError(error.message);
        setJobStatus(FAILURE_STATUS);
        setJobMessage("Failed to fetch job status.");
        stopPolling();
      });
    }, 2000);

    pollJob(targetJobId).catch((error) => {
      setJobError(error.message);
      setJobStatus(FAILURE_STATUS);
      setJobMessage("Failed to fetch job status.");
      stopPolling();
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    console.log("[app] handleFileChange called", {
      fileName: file?.name,
      size: file?.size,
    });
    setSelectedFile(file);
    setJobError("");
    setJobMessage(
      file ? "Ready to submit the video job." : "Select a video to start.",
    );
    setJobStatus("idle");
    setJobProgress(0);
    setJobId("");
    setJobResult(initialResult);
    setActiveTab("summary");
    stopPolling();
  };

  const handleCopyTranscript = () => {
    if (!transcriptData) return;
    navigator.clipboard.writeText(transcriptData).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setJobError("Please choose a video file first.");
      return;
    }

    setIsSubmitting(true);
    setJobError("");
    setJobMessage("Submitting video for background analysis...");
    setJobStatus("queued");
    setJobProgress(0);
    setJobResult(initialResult);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE}/api/video/analyze/job`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Job submission failed.");
      }

      const payload = await response.json();
      latestJobIdRef.current = payload.job_id;
      setJobId(payload.job_id);
      setJobMessage("Job queued. Polling for updates...");
      startPolling(payload.job_id);
    } catch (error) {
      setJobStatus(FAILURE_STATUS);
      setJobMessage("Submission failed.");
      setJobError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const emotionEntries = useMemo(() => {
    if (!emotionData) return [];

    return Object.entries(emotionData)
      .filter(([, value]) => typeof value === "number")
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  }, [emotionData]);

  const { majorEmotions, otherEmotions } = useMemo(() => {
    const sorted = [...emotionEntries].sort(([, a], [, b]) => b - a);
    return {
      majorEmotions: sorted.slice(0, 4),
      otherEmotions: sorted.slice(4),
    };
  }, [emotionEntries]);

  const viewMode = isFinished
    ? "final"
    : jobStatus === "idle"
      ? "upload"
      : isFailed
        ? "error"
        : "processing";

  const currentPhaseLabel = useMemo(() => {
    if (jobStatus === "queued") return "Queued";
    if (jobStatus === "started") return "Transcribing";
    if (jobStatus === "transcribed") return "Emotion Recognizing";
    if (jobStatus === "emotion_analyzed") return "Summary Generating";
    if (jobStatus === "summary_generated") return "Completing";
    return statusText;
  }, [jobStatus, statusText]);

  const completedStatuses = useMemo(() => {
    const currentIndex = statusFlow.findIndex(
      (item) => item.status === jobStatus,
    );
    if (currentIndex < 0) return [];
    return statusFlow.slice(0, currentIndex + 1).map((item) => item.status);
  }, [jobStatus]);

  const processingSteps = {
    queued: {
      title: "Your video is in the queue",
      description:
        "Hang tight — we’ve received your recording and are preparing it for analysis.",
      note: "This usually takes just a few seconds.",
    },
    started: {
      title: "Transcribing the audio",
      description:
        "Capturing speech from your video so the summary can reflect every important idea.",
      note: "Words are being converted into text right now.",
    },
    transcribed: {
      title: "Reading the emotion",
      description:
        "Analyzing facial cues, tone and expression to understand how the meeting felt.",
      note: "This helps produce a richer summary later.",
    },
    emotion_analyzed: {
      title: "Crafting your summary",
      description:
        "We’re turning the transcript and emotion signals into polished feedback.",
      note: "Almost done — your meeting analysis will be ready soon.",
    },
    summary_generated: {
      title: "Completing analysis",
      description: "Wrapping up and preparing the final dashboard layout.",
      note: "Just a moment.",
    },
  };

  const processingState = processingSteps[jobStatus] || {
    title: "Processing your submission",
    description: jobMessage,
    note: "Please wait while the analysis completes.",
  };

  const heroHeading =
    viewMode === "upload" ? (
      <>
        Upload a <span className="hero-highlight">recording</span>. We'll do the{" "}
        <span className="hero-highlight hero-highlight-secondary">rest</span>.
      </>
    ) : viewMode === "final" ? (
      <>
        Your <span className="hero-highlight">summary</span> is ready to
        <span className="hero-highlight hero-highlight-secondary"> review</span>
        .
      </>
    ) : (
      <>
        Turning your <span className="hero-highlight">meeting</span> into
        <span className="hero-highlight hero-highlight-secondary">
          {" "}
          insight
        </span>
        .
      </>
    );

  return (
    <main className="dashboard-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            Meeting video intelligence
          </p>
          <h1 key={viewMode} className="hero-title">
            {heroHeading}
          </h1>
          <p className="hero-text">
            Start with a single meeting video, then watch it move through the
            processing pipeline. Final insights appear only after analysis is
            fully completed.
          </p>
        </div>
      </header>

      {viewMode === "upload" ? (
        <section className="upload-container">
          <div className="upload-copy">
            <p className="eyebrow">Ready when you are</p>
            <h2>Upload a meeting video to begin.</h2>
            <p>
              We’ll transcribe the audio, analyze the emotions, and produce a
              short executive summary once the job completes.
            </p>
          </div>

          <form className="upload-card" onSubmit={handleSubmit}>
            <label className="file-dropzone">
              <input type="file" accept="video/*" onChange={handleFileChange} />
              <svg
                className="dropzone-icon"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                />
              </svg>
              <span className="dropzone-title">Select a video</span>
              <span className="dropzone-subtitle">
                MP4, WebM, MOV or other common formats.
              </span>
            </label>

            <button
              type="submit"
              className="primary-action"
              disabled={!selectedFile || isSubmitting}
            >
              {isSubmitting ? (
                "Submitting..."
              ) : selectedFile ? (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                  Submit video
                </>
              ) : (
                "Choose a file first"
              )}
            </button>

            <p className="muted-note">
              {selectedFile
                ? `Ready to upload: ${previewName}`
                : "Pick a video to get started."}
            </p>
          </form>
        </section>
      ) : viewMode === "processing" ? (
        <section className="processing-container">
          <div className="processing-hero">
            <div className="progress-wheel-container">
              <svg
                className="progress-wheel"
                width="110"
                height="110"
                viewBox="0 0 110 110"
              >
                <defs>
                  <linearGradient
                    id="progress-gradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="var(--accent-purple)" />
                    <stop offset="100%" stopColor="var(--accent-indigo)" />
                  </linearGradient>
                </defs>
                <circle
                  className="progress-wheel-bg"
                  cx="55"
                  cy="55"
                  r="48"
                  strokeWidth="6"
                />
                <circle
                  className="progress-wheel-fg"
                  cx="55"
                  cy="55"
                  r="48"
                  strokeWidth="6"
                  strokeDasharray="301.6"
                  strokeDashoffset={301.6 - (301.6 * jobProgress) / 100}
                />
              </svg>
              <div className="progress-wheel-text">
                <span className="progress-wheel-icon">
                  {iconForPhase(currentPhaseLabel)}
                </span>
                <span className="progress-wheel-percent">{jobProgress}%</span>
              </div>
            </div>

            <div className="processing-status-info">
              <p className="eyebrow">{currentPhaseLabel}</p>
              <h2>{processingState.title}</h2>
              <p className="processing-desc">{processingState.description}</p>
            </div>
          </div>

          <div className="pipeline-flow">
            {statusFlow.map((item, idx) => {
              const isCompleted = completedStatuses.includes(item.status);
              const isActive = jobStatus === item.status;
              return (
                <div
                  key={item.status}
                  className={`pipeline-step ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""}`}
                >
                  <div className="step-dot">
                    {isCompleted ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className="step-label">{item.label}</span>
                  {idx < statusFlow.length - 1 && (
                    <div className="step-connector" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : viewMode === "error" ? (
        <section className="error-container">
          <div className="error-icon-box">⚠️</div>
          <h2>Analysis Failed</h2>
          <p className="error-message-text">{jobError || jobMessage}</p>

          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              setJobStatus("idle");
              setJobMessage("Select a video to start.");
              setJobError("");
              setJobProgress(0);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M16 3h5v5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 21H3v-5" />
            </svg>
            Return to upload
          </button>
        </section>
      ) : (
        <section className="final-stage">
          <div className="final-sidebar">
            <div className="sidebar-header">
              <p className="eyebrow">Done</p>
              <h2>Analysis ready</h2>
            </div>

            <ul className="pipeline-vertical-flow">
              {statusFlow.map((item) => (
                <li
                  key={item.status}
                  className={`vertical-step ${completedStatuses.includes(item.status) ? "completed" : "pending"}`}
                >
                  <span className="vertical-step-icon">
                    {completedStatuses.includes(item.status) ? (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      "○"
                    )}
                  </span>
                  <span className="vertical-step-label">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="detail-shell">
            <div
              className="detail-tabs"
              role="tablist"
              aria-label="Result details"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "summary"}
                className={activeTab === "summary" ? "tab active" : "tab"}
                onClick={() => setActiveTab("summary")}
              >
                Summary
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "transcript"}
                className={activeTab === "transcript" ? "tab active" : "tab"}
                onClick={() => setActiveTab("transcript")}
              >
                Transcript
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "emotion"}
                className={activeTab === "emotion" ? "tab active" : "tab"}
                onClick={() => setActiveTab("emotion")}
              >
                Emotion data
              </button>
            </div>

            <div className="detail-card">
              {activeTab === "summary" ? (
                <div className="panel-content">
                  <p className="panel-kicker">Summary details</p>
                  <div className="summary-row">
                    <div>
                      <span className="meta-label">Grammar</span>
                      <strong>
                        {typeof summaryData?.grammar_score === "number"
                          ? formatPercentage(summaryData.grammar_score)
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="meta-label">Fluency</span>
                      <strong>
                        {typeof summaryData?.fluency_score === "number"
                          ? formatPercentage(summaryData.fluency_score)
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="meta-label">Confidence</span>
                      <strong>
                        {typeof summaryData?.confidence_score === "number"
                          ? formatPercentage(summaryData.confidence_score)
                          : "—"}
                      </strong>
                    </div>
                  </div>
                  <div className="summary-callout">
                    <h3>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ verticalAlign: "middle" }}
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Strengths
                    </h3>
                    <p>{summaryData?.strengths ?? "—"}</p>
                  </div>
                  <div className="summary-callout">
                    <h3>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ verticalAlign: "middle" }}
                      >
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.5 1.5 1.5 2.5" />
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                      </svg>
                      Improvements
                    </h3>
                    <p>{summaryData?.improvements ?? "—"}</p>
                  </div>
                  <div className="summary-callout">
                    <h3>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ verticalAlign: "middle" }}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="m16.2 7.8-2.9 4.3-4.3 2.9 2.9-4.3 4.3-2.9z" />
                      </svg>
                      Key Insight
                    </h3>
                    <p>{summaryData?.emotion_observation ?? "—"}</p>
                  </div>
                  <div className="summary-callout">
                    <h3>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ verticalAlign: "middle" }}
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Final Thought
                    </h3>
                    <p>{summaryData?.finalthought ?? "—"}</p>
                  </div>
                </div>
              ) : null}

              {activeTab === "transcript" ? (
                <div className="panel-content">
                  <div className="transcript-header-container">
                    <p className="panel-kicker">Transcript</p>
                    {transcriptData ? (
                      <button
                        type="button"
                        className={`copy-transcript-btn ${isCopied ? "copied" : ""}`}
                        onClick={handleCopyTranscript}
                      >
                        {isCopied ? (
                          <>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                width="14"
                                height="14"
                                x="8"
                                y="8"
                                rx="2"
                                ry="2"
                              />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                            Copy Transcript
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                  <p className="transcript-block">
                    {transcriptData ||
                      "Transcript will appear here once the job completes."}
                  </p>
                </div>
              ) : null}

              {activeTab === "emotion" ? (
                <div className="panel-content">
                  <p className="panel-kicker">Emotion details</p>
                  {emotionEntries.length > 0 ? (
                    <div className="emotion-list">
                      <div className="emotion-grid">
                        {majorEmotions.map(([label, value]) => (
                          <div className="emotion-chart" key={label}>
                            <div className="emotion-chart__meta">
                              <span>{formatLabel(label)}</span>
                              <strong>{formatPercentage(value)}</strong>
                            </div>
                            <div className="emotion-chart__bar">
                              <div
                                className="emotion-chart__fill"
                                style={{ width: formatPercentage(value) }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {otherEmotions.length > 0 ? (
                        <div className="emotion-secondary-list">
                          <p className="panel-kicker">Other emotions</p>
                          <div className="emotion-secondary-chips">
                            {otherEmotions.map(([label, value]) => (
                              <span className="emotion-badge" key={label}>
                                {formatLabel(label)} • {formatPercentage(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="muted-note">
                      Emotion breakdown will appear here once the analysis
                      completes.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
