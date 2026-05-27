import type { ChatMessage } from "../../lib/aiTypes";

export default function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") return null; // never shown
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}>
      <div
        className={
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm " +
          (isUser
            ? "bg-brand-600 text-white rounded-bl-md"
            : "bg-white border border-slate-200 text-slate-800 rounded-br-md")
        }
      >
        {message.content.split("\n").map((line, i) => (
          <p key={i} className={i > 0 ? "mt-1.5" : ""}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
