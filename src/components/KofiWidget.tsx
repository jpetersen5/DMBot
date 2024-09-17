import React, { useEffect } from "react";

declare global {
  interface Window {
    kofiWidgetOverlay?: {
      draw: (username: string, options: any) => void;
    };
  }
}

const KofiWidget: React.FC = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
    script.async = true;
    script.onload = () => {
      if (window.kofiWidgetOverlay) {
        window.kofiWidgetOverlay.draw("satandrums", {
          "type": "floating-chat",
          "floating-chat.donateButton.text": "Support me",
          "floating-chat.donateButton.background-color": "#404040",
          "floating-chat.donateButton.text-color": "#fff"
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
};

export default KofiWidget;