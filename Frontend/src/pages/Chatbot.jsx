import { useState } from "react";
import "../styles/chatbot1.css";
import axios from "axios";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!userMessage.trim()) return;

    const newUserMsg = { sender: "user", text: userMessage };
    setChatMessages((prev) => [...prev, newUserMsg]);

    setIsLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/admin/chatbot", {
        message: userMessage,
      });

      // ✅ Use 'reply' instead of 'aiReply'
      const aiMessage = { sender: "bot", text: res.data.reply };
      setChatMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMsg = {
        sender: "bot",
        text: "Error getting response from AI.",
      };
      setChatMessages((prev) => [...prev, errorMsg]);
      console.error("Chatbot error:", err);
    } finally {
      setIsLoading(false);
      setUserMessage("");
    }
  };

  return (
    <div className="chatbot-container">
      <div
        className="chatboticon"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ cursor: "pointer" }}
      >
        <img
          src="https://static.vecteezy.com/system/resources/previews/034/211/479/non_2x/ai-chatbots-icon-illustration-vector.jpg"
          alt="Chatbot"
        />
      </div>

      {isOpen && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <h4>Chat AI</h4>
            <i
              className="fa-solid fa-xmark close-icon"
              style={{ cursor: "pointer", fontSize: "15px" }}
              onClick={() => setIsOpen(false)}
            ></i>
          </div>

          <div className="chatbot-body">
            <div className="bot-msg">Hello 👋 How can I help you today?</div>
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={msg.sender === "user" ? "user-msg" : "bot-msg"}
              >
                {msg.text}
              </div>
            ))}
            {isLoading && (
              <div className="bot-msg typing">AI is thinking...</div>
            )}
          </div>

          <div className="chatbot-footer">
            <input
              type="text"
              placeholder="Type your message..."
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(e)}
              disabled={isLoading}
            />
            <button onClick={handleSend} disabled={isLoading}>
              {isLoading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
