"use client";

import Script from "next/script";

export default function HomePage() {
  return (
    <>
      <Script
        id="gtm-init"
        strategy="afterInteractive"
      >{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WC82WZGC');`}</Script>
      <Script
        src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"
        strategy="afterInteractive"
      />
      <Script
        type="module"
        // The compiled client entrypoint is deployed to /src/client.js
        // via deploy_static.sh copying site/dist/site/src/* to the web root.
        src="/src/client.js"
        strategy="afterInteractive"
      />

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            Oxygen-Sans, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          padding: 1rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        h1 {
          color: #2c3e50;
          margin-bottom: 1rem;
          font-size: 2rem;
        }

        h2 {
          color: #34495e;
          margin-bottom: 0.8rem;
          font-size: 1.4rem;
        }

        h3 {
          color: #34495e;
          margin-bottom: 0.6rem;
          font-size: 1.2rem;
        }

        article {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 1.5rem;
        }

        article p {
          margin-bottom: 1rem;
        }
        article p:only-child {
          margin-bottom: 0;
        }

        .container {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        #rooms {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        #roomList {
          list-style: none;
        }

        #roomList li {
          padding: 0.8rem;
          border-radius: 6px;
          margin-bottom: 0.5rem;
          background: #f8f9fa;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }

        #roomList li[data-room-count]::after {
          content: '(' attr(data-room-count) ' players)';
          float: right;
          opacity: 0.6;
          font-size: 0.9rem;
        }

        #roomList li[data-room-count='1']::after {
          content: '(' attr(data-room-count) ' player)';
          float: right;
          opacity: 0.6;
          font-size: 0.9rem;
        }

        #roomList li:hover {
          background: #e9ecef;
        }

        #roomList li.active {
          background: #e3f2fd;
          border-color: #4299e1;
          font-weight: 600;
        }

        #chat {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          height: calc(100vh - 200px);
          min-height: 500px;
        }

        #messages {
          flex-grow: 1;
          overflow-y: auto;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 1rem;
          min-height: min(300px, 50%);
        }

        #messages div {
          margin-bottom: 0.5rem;
          padding: 0.5rem;
          border-radius: 4px;
          background: white;
        }

        #messages div.system {
          font-style: italic;
          color: #6c757d;
          background: transparent;
        }

        .input-group {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        #messageInput {
          flex-grow: 1;
          padding: 0.8rem;
          border: 1px solid #ced4da;
          border-radius: 6px;
          font-size: 1rem;
        }

        #messageInput:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
        }

        button {
          padding: 0.8rem 1.5rem;
          background: #4299e1;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          transition: background-color 0.2s;
        }

        button:hover {
          background: #3182ce;
        }

        button:disabled {
          background: #cbd5e0;
          cursor: not-allowed;
        }

        .games {
          display: grid;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .games h3 {
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }

        .game-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
          border: 2px solid transparent;
        }

        .game-item:hover:not(.disabled) {
          background: #e9ecef;
        }

        .game-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .game-item.ready {
          background: #e6ffed;
          border-color: #48bb78;
        }

        .game-name {
          font-weight: 500;
          flex: 1;
        }

        .game-players {
          font-size: 0.85rem;
          color: #666;
          margin-left: 0.5rem;
        }

        .game-players.ready {
          color: #48bb78;
          font-weight: 600;
        }

        .game-players.waiting {
          color: #e53e3e;
        }

        .game-timeout {
          font-size: 0.75rem;
          color: #f6ad55;
          margin-top: 0.25rem;
          font-weight: 500;
        }

        .game-timeout::before {
          content: '⏱ ';
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        #qr-container {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 6px;
          text-align: center;
          margin-bottom: 1rem;
          border: 1px solid #e2e8f0;
        }

        #qr-container h4 {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          color: #666;
        }

        #qr-code {
          display: inline-block;
          margin: 0.5rem 0;
        }

        #qr-code img {
          display: block;
        }

        #share-url {
          word-break: break-all;
          font-family: monospace;
          font-size: 0.75rem;
          color: #666;
          margin: 0.5rem 0;
        }

        .share-buttons {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          margin-top: 0.75rem;
        }

        .share-buttons button {
          padding: 0.6rem 1rem;
          font-size: 0.9rem;
        }

        #clients {
          margin-top: auto;
          border-top: 1px solid #e2e8f0;
          padding-top: 1rem;
        }

        #clientList {
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        #clientList li {
          background: #edf2f7;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .container {
            grid-template-columns: 1fr;
          }

          #chat {
            height: calc(100vh - 400px);
          }

          .games {
            flex-direction: column;
            align-items: stretch;
          }

          .games button {
            width: 100%;
          }

          h1 {
            font-size: 1.5rem;
          }

          article {
            padding: 1rem;
          }

          #rooms,
          #chat {
            padding: 1rem;
          }
        }
      `}</style>

      <noscript>
        <iframe
          src="https://www.googletagmanager.com/ns.html?id=GTM-WC82WZGC"
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>

      <h1>hackbox.tv</h1>
      <article>
        <p>
          <strong>Instructions:</strong> Select a room then click a game or chat
          with others. No data sent or received is stored on a server.
        </p>
        <div style={{ marginTop: "1rem" }}>
          <label
            htmlFor="playerNameInput"
            style={{ marginRight: "0.5rem" }}
          >
            Your Name:
          </label>
          <input
            type="text"
            id="playerNameInput"
            placeholder="Enter your name..."
            maxLength={20}
            style={{
              padding: "0.5rem",
              border: "1px solid #ccc",
              borderRadius: 4,
              width: 200,
            }}
          />
          <button
            id="playerNameSaveButton"
            type="button"
            style={{
              marginLeft: "0.5rem",
              padding: "0.45rem 0.9rem",
              fontSize: "0.9rem",
            }}
          >
            Save
          </button>
          <span
            id="playerNameDisplay"
            style={{ marginLeft: "0.5rem", fontWeight: "bold" }}
          />
        </div>
      </article>
      <div className="container">
        <div id="rooms">
          <h2>Available Rooms</h2>
          <ul id="roomList" />
        </div>
        <div id="chat">
          <h2 id="roomName">Not in a room</h2>
          <div id="qr-container" style={{ display: "none" }}>
            <h4>Share this room</h4>
            <div id="qr-code" />
            <div id="share-url" />
            <div className="share-buttons">
              <button id="share-button" type="button">
                Share Link
              </button>
              <button id="copy-button" type="button">
                Copy Link
              </button>
            </div>
          </div>
          <div id="messages" />
          <div className="input-group">
            <input
              type="text"
              id="messageInput"
              placeholder="Type a message..."
              disabled
            />
            <button id="sendButton" disabled>
              Send
            </button>
          </div>
          <div id="clients">
            <div className="games">
              <h3>Available Games</h3>
              <div id="game-list" />
            </div>
            <h3>Clients in Room:</h3>
            <ul id="clientList" />
          </div>
        </div>
      </div>
    </>
  );
}
