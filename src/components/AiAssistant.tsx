import React, { useState, useRef, useEffect } from "react";
import { ERPState } from "../types";
import { Sparkles, Send, Bot, User, HelpCircle, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiAssistantProps {
  state: ERPState;
}

export default function AiAssistant({ state }: AiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Namaste! I am **Divine CFO AI**, your commercial operations assistant. I have complete access to your firm's active ledgers, outstanding invoices, and physical warehouse balances.\n\nHow can I help you optimize your business today? Try one of the quick analysis templates below!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const getPrunedErpState = (fullState: ERPState) => {
    if (!fullState) return {};
    const {
      backups,
      activityLogs,
      loginHistory,
      companyProfile,
      ...rest
    } = fullState;

    const cleanCompanyProfile = companyProfile
      ? {
          ...companyProfile,
          logoUrl: companyProfile.logoUrl?.startsWith("data:")
            ? "[BASE64_LOGO_OMITTED]"
            : companyProfile.logoUrl,
        }
      : undefined;

    return {
      ...rest,
      companyProfile: cleanCompanyProfile,
      activityLogs: (activityLogs || []).slice(0, 30),
      loginHistory: (loginHistory || []).slice(0, 15),
    };
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          erpState: getPrunedErpState(state),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to communicate with Divine CFO AI server.");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content || "I am sorry, I couldn't compute a response." },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Error connecting to Gemini AI Service:** ${err.message || "Please make sure your GEMINI_API_KEY is configured in the secrets menu."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    handleSend(promptText);
  };

  // Safe and robust lightweight renderer for custom markdown in chat bubbles
  const renderMarkdownText = (text: string) => {
    return text.split("\n").map((line, lineIdx) => {
      // Check if it's a bullet point
      const isBullet = line.trim().startsWith("* ") || line.trim().startsWith("- ");
      let cleanLine = line;
      if (isBullet) {
        cleanLine = line.trim().substring(2);
      }

      // Format bold markup **bold**
      const parts = cleanLine.split(/\*\*([\s\S]*?)\*\*/g);
      const formattedLine = parts.map((part, partIdx) => {
        if (partIdx % 2 === 1) {
          return <strong key={partIdx} className="font-extrabold text-slate-900">{part}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <li key={lineIdx} className="list-disc ml-5 mt-1 text-slate-700">
            {formattedLine}
          </li>
        );
      }

      return (
        <p key={lineIdx} className={`${line.trim() === "" ? "h-2" : "mt-1.5"} text-slate-700 leading-relaxed`}>
          {formattedLine}
        </p>
      );
    });
  };

  const quickPrompts = [
    {
      title: "Audit Low-Stock & Reorders",
      prompt: "Can you list all items in our inventory that are currently running below their minimum stock thresholds, and estimate the cost to buy 50 bags of each?",
    },
    {
      title: "Draft Vendor Email",
      prompt: "I need to request a 15-day payment extension on our largest outstanding bill. Can you identify the vendor, the bill, and write a polite, professional draft email?",
    },
    {
      title: "Analyze cash flow liabilities",
      prompt: "Analyze our accounts payables. Tell me our total outstanding vendor liabilities and rank the top 3 vendors who we owe the most money to, with payment suggestions.",
    },
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-none bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* AI Header */}
      <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
              Divine CFO AI Assistant
              <span className="text-[9px] bg-indigo-500 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">CFO Bot</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Equipped with real-time operational context</p>
          </div>
        </div>
      </div>

      {/* Messages Sandbox */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {messages.map((m, idx) => {
          const isAi = m.role === "assistant";
          return (
            <div key={idx} className={`flex gap-3 max-w-4xl ${isAi ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 shadow-sm ${
                  isAi ? "bg-indigo-50 text-indigo-800 border-indigo-100" : "bg-slate-100 text-slate-800 border-slate-200"
                }`}
              >
                {isAi ? <Bot size={15} /> : <User size={15} />}
              </div>

              {/* Chat Bubble */}
              <div
                className={`p-4 rounded-2xl text-xs shadow-xs ${
                  isAi
                    ? "bg-white text-slate-800 border border-slate-150 rounded-tl-none leading-relaxed"
                    : "bg-indigo-600 text-white rounded-tr-none shadow-sm leading-relaxed"
                }`}
              >
                {isAi ? renderMarkdownText(m.content) : <p className="leading-relaxed">{m.content}</p>}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 max-w-2xl mr-auto">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-800 border border-indigo-100 shadow-sm">
              <Bot size={15} />
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none text-xs flex items-center gap-2 text-slate-500 shadow-xs font-medium">
              <Loader2 className="animate-spin text-indigo-600" size={14} />
              Divine CFO AI is parsing ledgers & compiling response...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions Cards */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 py-3 bg-slate-50 border-t border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
          {quickPrompts.map((p, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleQuickPrompt(p.prompt)}
              className="p-3.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 text-left hover:border-indigo-600 shadow-xs flex flex-col justify-between transition-all group cursor-pointer"
            >
              <span className="font-bold text-slate-800 text-[10px] group-hover:text-indigo-600 transition-colors uppercase tracking-wider block">
                {p.title}
              </span>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{p.prompt}</p>
            </button>
          ))}
        </div>
      )}

      {/* TextInput Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="p-3.5 border-t border-slate-200 bg-white flex gap-2.5 items-center"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLoading ? "Divine CFO AI is thinking..." : "Ask about outstanding bills, ledger balances, low stock counts..."}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-slate-50 text-xs border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-sm cursor-pointer"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
