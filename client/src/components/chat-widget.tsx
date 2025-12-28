import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, RotateCcw, Minus, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChatMessage, ChatConversation } from "@shared/schema";

interface QuickAction {
  label: string;
  value: string;
  type: 'specialty' | 'professional' | 'datetime' | 'text';
  data?: any;
}

interface DayAvailability {
  dayLabel: string; // "14 Mardi OCT"
  dayNumber: string; // "14"
  dayName: string; // "Mardi"
  month: string; // "OCT"
  date: string; // "2025-10-14"
  times: string[]; // ["10:00", "10:20", ...]
}

// Parse message to extract day-grouped availabilities
function parseWeeklyAvailabilities(message: string): DayAvailability[] | null {
  // Check if message contains weekly availabilities format
  if (!message.includes('**') || !message.includes('disponibilités')) {
    return null;
  }

  const days: DayAvailability[] = [];
  const dayPattern = /\*\*([^*]+)\*\*\s*:\s*([^*\n]+)/g;
  let match;

  while ((match = dayPattern.exec(message)) !== null) {
    const dayLabel = match[1].trim(); // "Mar. 14 oct"
    const timesStr = match[2].trim(); // "10:00, 10:20, ..."
    const times = timesStr.split(',').map(t => t.trim()).filter(t => t.match(/^\d{1,2}:\d{2}$/));

    // Parse day label to extract components
    const parts = dayLabel.split(' '); // ["Mar.", "14", "oct"]
    if (parts.length >= 3) {
      const dayName = parts[0].replace('.', ''); // "Mar"
      const dayNumber = parts[1]; // "14"
      const monthName = parts[2].replace('.', ''); // "oct" (remove trailing dot)
      
      // Convert month name to uppercase abbreviation
      const monthMap: Record<string, string> = {
        'jan': 'JAN', 'fév': 'FÉV', 'fev': 'FÉV', 'mar': 'MAR', 'avr': 'AVR', 
        'mai': 'MAI', 'juin': 'JUIN', 'juil': 'JUIL', 'aoû': 'AOÛ', 'août': 'AOÛ', 'aout': 'AOÛ',
        'sep': 'SEP', 'oct': 'OCT', 'nov': 'NOV', 'déc': 'DÉC', 'dec': 'DÉC'
      };
      
      const dayNameMap: Record<string, string> = {
        'Lun': 'Lundi', 'Mar': 'Mardi', 'Mer': 'Mercredi', 
        'Jeu': 'Jeudi', 'Ven': 'Vendredi', 'Sam': 'Samedi', 'Dim': 'Dimanche'
      };

      // Get month number (1-12) from month name
      const monthNamesArray = ['jan', 'fév', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'août', 'aout', 'sep', 'oct', 'nov', 'déc', 'dec'];
      const monthToNumber: Record<string, number> = {
        'jan': 1, 'fév': 2, 'fev': 2, 'mar': 3, 'avr': 4, 'mai': 5, 'juin': 6,
        'juil': 7, 'aoû': 8, 'août': 8, 'aout': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'déc': 12, 'dec': 12
      };
      const monthNum = monthToNumber[monthName.toLowerCase()] || 0;
      
      // Extract year from message if available, otherwise use current year
      const currentYear = new Date().getFullYear();
      const date = monthNum > 0 
        ? `${currentYear}-${monthNum.toString().padStart(2, '0')}-${dayNumber.padStart(2, '0')}`
        : '';

      if (date) {
        days.push({
          dayLabel: `${dayNumber} ${dayNameMap[dayName] || dayName}`,
          dayNumber,
          dayName: dayNameMap[dayName] || dayName,
          month: monthMap[monthName.toLowerCase()] || monthName.toUpperCase(),
          date,
          times
        });
      }
    }
  }

  return days.length > 0 ? days : null;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const previousConversationIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Get or create conversation
  const [resetFlag, setResetFlag] = useState(false);
  const { data: conversation } = useQuery<ChatConversation>({
    queryKey: ['/api/chat/conversation', resetFlag],
    queryFn: async () => {
      const url = resetFlag ? '/api/chat/conversation?reset=true' : '/api/chat/conversation';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to get conversation');
      return res.json();
    },
    enabled: isOpen && (!conversationId || resetFlag),
  });

  // Get messages for conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chat/messages', conversationId || conversation?.id],
    enabled: !!(conversationId || conversation?.id),
  });

  // Get quick actions (suggestions)
  const { data: quickActions = [] } = useQuery<QuickAction[]>({
    queryKey: ['/api/chat/quick-actions', conversationId || conversation?.id],
    enabled: !!(conversationId || conversation?.id),
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const activeConversationId = conversationId || conversation?.id;
      if (!activeConversationId) {
        throw new Error("No active conversation");
      }
      
      const response = await apiRequest('POST', '/api/chat/messages', {
        conversationId: activeConversationId,
        content,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages', conversationId || conversation?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/quick-actions', conversationId || conversation?.id] });
      setMessage("");
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message. Veuillez réessayer.",
        variant: "destructive",
      });
    },
  });

  // Update conversation ID when we get one
  useEffect(() => {
    if (conversation?.id && (!conversationId || resetFlag)) {
      setConversationId(conversation.id);
      setResetFlag(false);
    }
  }, [conversation, conversationId, resetFlag]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset showAllSlots and expandedDays when conversation changes
  useEffect(() => {
    if (conversationId && conversationId !== previousConversationIdRef.current) {
      setShowAllSlots(false);
      setExpandedDays(new Set());
      previousConversationIdRef.current = conversationId;
    }
  }, [conversationId]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessageMutation.mutate(action.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setConversationId(null);
    setResetFlag(true);
    queryClient.invalidateQueries({ queryKey: ['/api/chat/conversation'] });
    queryClient.invalidateQueries({ queryKey: ['/api/chat/messages'] });
    queryClient.invalidateQueries({ queryKey: ['/api/chat/quick-actions'] });
  };

  return (
    <>
      {/* Floating Chat Button - Hidden temporarily */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 z-50 hidden"
        data-testid="button-open-chat"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </Button>

      {/* Chat Overlay */}
      {isOpen && (
        <div className={`fixed bottom-24 right-6 w-96 ${isMinimized ? 'h-auto' : 'h-[600px]'} bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50`}>
          {/* Header */}
          <div className={`bg-blue-600 text-white p-4 ${isMinimized ? 'rounded-2xl' : 'rounded-t-2xl'} cursor-pointer`} onClick={() => isMinimized && setIsMinimized(false)}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg" data-testid="chat-title">
                  Assistant Gobering
                </h3>
                {!isMinimized && (
                  <p className="text-sm text-blue-100">
                    Prenez rendez-vous en quelques clics
                  </p>
                )}
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {!isMinimized && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-white hover:bg-blue-700"
                    data-testid="button-reset-chat"
                    title="Nouvelle conversation"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white hover:bg-blue-700"
                  data-testid="button-minimize-chat"
                  title={isMinimized ? "Agrandir" : "Réduire"}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-blue-700"
                  data-testid="button-close-chat"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          {!isMinimized && (
          <ScrollArea className="flex-1 p-4">
            {messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-4">
                {messages.length === 0 && quickActions.length > 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <MessageCircle className="h-16 w-16 text-blue-600 mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      Bonjour ! 👋
                    </h4>
                    <p className="text-gray-600 text-sm mb-6">
                      Je suis votre assistant pour prendre rendez-vous. Choisissez une spécialité pour commencer :
                    </p>
                    <div className="w-full space-y-2">
                      {quickActions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuickAction(action)}
                          className="w-full text-left p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-sm text-gray-800 font-medium transition-colors border border-blue-200"
                          data-testid={`quick-action-${index}`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      // Check if message contains weekly availabilities
                      const weeklyAvailabilities = msg.role === 'assistant' ? parseWeeklyAvailabilities(msg.content) : null;
                      
                      if (weeklyAvailabilities) {
                        // Extract header message
                        const headerMatch = msg.content.match(/Voici les disponibilités ([^:]+):/);
                        const header = headerMatch ? headerMatch[0] : '';
                        
                        return (
                          <div key={msg.id} className="space-y-3" data-testid={`message-${msg.role}-${msg.id}`}>
                            {header && (
                              <div className="bg-gray-100 text-gray-900 rounded-2xl px-4 py-2">
                                <p className="text-sm">{header}</p>
                              </div>
                            )}
                            {weeklyAvailabilities.map((day, dayIndex) => (
                              <div key={dayIndex} className="overflow-hidden rounded-lg border border-gray-200">
                                {/* Day Header */}
                                <div className="bg-blue-600 text-white p-3">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold">{day.dayNumber}</span>
                                    <span className="text-lg font-medium">{day.dayName}</span>
                                  </div>
                                  <div className="text-sm text-blue-100 mt-1">
                                    {day.month} · {day.times.length} créneaux disponibles
                                  </div>
                                </div>
                                {/* Time Slots Grid */}
                                <div className="bg-white p-3">
                                  <div className="grid grid-cols-3 gap-2">
                                    {day.times.slice(0, expandedDays.has(day.date) ? undefined : 9).map((time, timeIndex) => (
                                      <button
                                        key={timeIndex}
                                        onClick={() => handleQuickAction({ 
                                          label: time, 
                                          value: `HEURE:${day.date}:${time}`, 
                                          type: 'datetime' 
                                        })}
                                        className="flex items-center justify-center gap-1 p-2 rounded-lg border border-gray-300 hover:border-blue-600 hover:bg-blue-50 text-sm text-gray-700 transition-colors"
                                        data-testid={`time-slot-${dayIndex}-${timeIndex}`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {time}
                                      </button>
                                    ))}
                                  </div>
                                  {day.times.length > 9 && !expandedDays.has(day.date) && (
                                    <button
                                      onClick={() => setExpandedDays(prev => new Set(prev).add(day.date))}
                                      className="w-full mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                      ...voir plus de dispo
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      
                      // Default message display
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          data-testid={`message-${msg.role}-${msg.id}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                              msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Quick Actions - only show if last message doesn't have weekly availabilities */}
                    {quickActions.length > 0 && !sendMessageMutation.isPending && (() => {
                      // Check if last bot message contains weekly availabilities
                      const lastBotMessage = [...messages].reverse().find(m => m.role === 'assistant');
                      const hasWeeklyAvailabilities = lastBotMessage && parseWeeklyAvailabilities(lastBotMessage.content);
                      
                      // Don't show quick actions if they're already displayed in weekly view
                      if (hasWeeklyAvailabilities) {
                        return null;
                      }
                      
                      // Check if actions are time slots (format: "HH:MM" or "Day DD - HH:MM")
                      const areTimeSlots = quickActions.length > 0 && 
                        quickActions[0].type === 'datetime' && 
                        (quickActions[0].label.match(/^\d{1,2}:\d{2}$/) || quickActions[0].label.includes(' - '));
                      
                      if (areTimeSlots) {
                        const initialDisplayCount = 12;
                        const displayedActions = showAllSlots ? quickActions : quickActions.slice(0, initialDisplayCount);
                        const hasMore = quickActions.length > initialDisplayCount;
                        
                        return (
                          <div className="pt-2">
                            <div className="grid grid-cols-4 gap-2">
                              {displayedActions.map((action, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleQuickAction(action)}
                                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs text-white font-medium transition-colors"
                                  data-testid={`quick-action-${index}`}
                                >
                                  {action.label.includes(' - ') ? action.label.split(' - ')[1] : action.label}
                                </button>
                              ))}
                            </div>
                            {hasMore && !showAllSlots && (
                              <button
                                onClick={() => setShowAllSlots(true)}
                                className="w-full mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                data-testid="button-show-more-slots"
                              >
                                ...voir plus de dispo
                              </button>
                            )}
                          </div>
                        );
                      }
                      
                      // Default display for non-time-slot actions
                      return (
                        <div className="space-y-2 pt-2">
                          {quickActions.map((action, index) => (
                            <button
                              key={index}
                              onClick={() => handleQuickAction(action)}
                              className="w-full text-left p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-sm text-gray-800 font-medium transition-colors border border-blue-200"
                              data-testid={`quick-action-${index}`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            )}
          </ScrollArea>
          )}

          {/* Input Area */}
          {!isMinimized && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Écrivez votre message..."
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-chat-message"
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
