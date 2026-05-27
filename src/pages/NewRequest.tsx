import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StepIndicator from "../components/chat/StepIndicator";
import ChatBubble from "../components/chat/ChatBubble";
import ChatInput from "../components/chat/ChatInput";
import AiThinkingState from "../components/chat/AiThinkingState";
import ExtractedFactsCard from "../components/chat/ExtractedFactsCard";
import RouteRecommendationCard from "../components/chat/RouteRecommendationCard";
import MissingInfoQuestions from "../components/chat/MissingInfoQuestions";
import { useAuth } from "../lib/auth";
import { callRouting, guessSupplierName } from "../lib/aiClient";
import { createChatRequest } from "../lib/requests";
import type {
  ChatMessage,
  ChatStep,
  RoutingResponse,
} from "../lib/aiTypes";

const HERO_CHIPS = [
  { label: "רכישת שירות", value: "אנחנו רוצים לרכוש שירות מ-" },
  { label: "מענק", value: "אנחנו רוצים להעביר מענק ל-" },
  { label: "ייעוץ", value: "אנחנו רוצים להתקשר עם יועץ ל-" },
  { label: "פעילות עם משתתפים", value: "מתכננים פעילות עם משתתפים: " },
  { label: "לא בטוח", value: "אני לא בטוח/ה איך לסווג את הפנייה הבאה: " },
];

/**
 * Chat-first intake. The first screen is a single large input. After the user
 * sends the description, we call the AI router, show what was understood, and
 * let the user approve the proposed route (or answer follow-up questions).
 */
export default function NewRequest() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState<ChatStep>("describe");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [routing, setRouting] = useState<RoutingResponse | null>(null);
  const [thinking, setThinking] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, routing, thinking]);

  // ---- Initial description send -------------------------------------------
  async function handleInitialSend(text: string) {
    setError(null);
    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      ts: new Date().toISOString(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStep("clarify");
    setThinking(true);
    try {
      const supplierGuess = guessSupplierName(text);
      const result = await callRouting({
        messages: newMessages,
        inferredSupplierName: supplierGuess,
      });
      setRouting(result);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.user_facing_message_he,
        ts: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistantMsg]);
      // If there are no clarifying questions or the model says it can continue,
      // go straight to the route review.
      if (
        result.next_questions_he.length === 0 ||
        result.can_continue_with_partial_info
      ) {
        setStep("review_route");
      } else {
        setStep("clarify");
      }
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בקריאה ל-AI");
      setStep("describe");
    } finally {
      setThinking(false);
    }
  }

  // ---- Follow-up turn (clarify step) --------------------------------------
  async function handleClarifySend(text: string) {
    if (!routing) return;
    setError(null);
    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      ts: new Date().toISOString(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setThinking(true);
    try {
      const result = await callRouting({
        messages: newMessages,
        inferredSupplierName:
          guessSupplierName(text) ?? routing.request_summary.second_party,
      });
      setRouting(result);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.user_facing_message_he,
        ts: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistantMsg]);
      if (
        result.next_questions_he.length === 0 ||
        result.can_continue_with_partial_info ||
        isContinueSignal(text)
      ) {
        setStep("review_route");
      }
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בקריאה ל-AI");
    } finally {
      setThinking(false);
    }
  }

  // ---- Approve route → persist & navigate ---------------------------------
  async function approveRoute() {
    if (!routing || !user) return;
    setPersisting(true);
    setError(null);
    try {
      const originalDescription = messages.find((m) => m.role === "user")?.content ?? "";
      const record = await createChatRequest({
        userId: user.id,
        userEmail: user.email ?? null,
        description: originalDescription,
        chatMessages: messages,
        routing,
      });
      if (routing.route === "legal_review") {
        nav(`/requests/${record.id}/legal`);
      } else {
        nav(`/requests/${record.id}`);
      }
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה");
    } finally {
      setPersisting(false);
    }
  }

  // ---- Render --------------------------------------------------------------
  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <StepIndicator current={step} />

        {step === "describe" && messages.length === 0 ? (
          <HeroDescribe onSend={handleInitialSend} disabled={thinking} />
        ) : (
          <div className="space-y-4">
            <div
              ref={scrollRef}
              className="space-y-3 max-h-[55vh] overflow-y-auto pr-1"
            >
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
              {thinking && <AiThinkingState />}
            </div>

            {routing && step !== "describe" && (
              <ExtractedFactsCard routing={routing} />
            )}

            {routing && step === "clarify" && !thinking && (
              <>
                <MissingInfoQuestions
                  questions={routing.next_questions_he}
                  onPick={(q) => setDraftAnswer(q + " — ")}
                />
                <ChatInput
                  placeholder="ענה/י כאן או כתבו 'תמשיך' כדי לקבל המלצה עם המידע הקיים"
                  onSend={handleClarifySend}
                  busy={thinking}
                  disabled={thinking}
                  initialText={draftAnswer}
                />
              </>
            )}

            {routing && step === "review_route" && (
              <RouteRecommendationCard
                routing={routing}
                onApprove={approveRoute}
                onAmend={() => {
                  setStep("clarify");
                }}
                approveLabel={
                  persisting
                    ? "שומר..."
                    : routing.route === "legal_review"
                    ? "מאשר/ת והמשך לבדיקה משפטית"
                    : "מאשר/ת וממשיכים"
                }
              />
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function HeroDescribe({
  onSend,
  disabled,
}: {
  onSend: (t: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="text-center pt-8">
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
        ספרו לי על הפנייה
      </h1>
      <p className="text-slate-500 mb-10 max-w-xl mx-auto leading-relaxed">
        אפשר לכתוב חופשי. נסו לכלול אם ידוע: מטרת ההתקשרות, הצד השני, סכום משוער,
        הצעת מחיר, ומה כל צד אמור לתת או לקבל.
      </p>
      <div className="max-w-2xl mx-auto">
        <ChatInput
          size="hero"
          placeholder="לדוגמה: יום גיבוש לעובדים בצפון, ODT, 35,000 ₪, יש הצעת מחיר נקייה..."
          onSend={onSend}
          chips={HERO_CHIPS}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function isContinueSignal(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /(לא יודע|אין לי עוד מידע|תמשיך|אפשר להמשיך|להמשיך)/.test(t);
}
